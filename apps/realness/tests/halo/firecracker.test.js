/**
 * The Firecracker API client and the boot recipe.
 *
 * `Api` talks HTTP over a unix socket, so one real server on a temp socket
 * covers the client without a VM. `boot`, `pause`, and the two snapshot
 * calls take their `api` as an argument, so a recording stand-in covers the
 * request shapes.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { out_path } from '#root/lib/output.js'
import {
  Api,
  boot,
  createSnapshot,
  loadSnapshot,
  pause
} from '../../src/halo/firecracker.js'

/** A real HTTP server on a throwaway unix socket. */
const serve_socket = async (t, handler) => {
  mkdirSync(out_path(), { recursive: true })
  const where = mkdtempSync(out_path('fc-api-'))
  t.after(() => rmSync(where, { recursive: true, force: true }))
  const socket = join(where, 'api.sock')
  const server = createServer(handler)
  await new Promise(done => server.listen(socket, done))
  t.after(() => new Promise(done => server.close(done)))
  return socket
}

const read_body = request =>
  new Promise(done => {
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => done(Buffer.concat(chunks).toString()))
  })

/** An api that records what it was asked, standing in for a running VM. */
const fake_api = () => {
  const calls = []
  return {
    calls,
    put: async (path, body) => {
      calls.push(['PUT', path, body])
    },
    patch: async (path, body) => {
      calls.push(['PATCH', path, body])
    }
  }
}

const BOOT_ARGS = 'keep_bootcon console=ttyS0 reboot=k panic=1'

test('a call sends JSON and returns what came back', async t => {
  const seen = []
  const socket = await serve_socket(t, async (request, response) => {
    seen.push({
      method: request.method,
      url: request.url,
      type: request.headers['content-type'],
      length: request.headers['content-length'],
      body: await read_body(request)
    })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ state: 'NotStarted' }))
  })

  const api = new Api(socket)
  assert.deepEqual(await api.put('/vm', { state: 'Paused' }), {
    state: 'NotStarted'
  })
  assert.deepEqual(seen[0], {
    method: 'PUT',
    url: '/vm',
    type: 'application/json',
    length: String(Buffer.byteLength('{"state":"Paused"}')),
    body: '{"state":"Paused"}'
  })
})

test('a call with no body sends none, and an empty reply reads as an object', async t => {
  const seen = []
  const socket = await serve_socket(t, async (request, response) => {
    seen.push({
      type: request.headers['content-type'],
      length: request.headers['content-length'],
      body: await read_body(request)
    })
    response.writeHead(200)
    response.end()
  })

  assert.deepEqual(await new Api(socket).patch('/vm'), {})
  assert.deepEqual(seen[0], {
    type: undefined,
    length: '0',
    body: ''
  })
})

test('a refusal names the method, the path, the status, and the reply', async t => {
  const socket = await serve_socket(t, (request, response) => {
    response.writeHead(400, { 'content-type': 'application/json' })
    response.end('{"fault_message":"no such device"}')
  })

  await assert.rejects(new Api(socket).put('/drives/x', {}), error => {
    assert.match(
      error.message,
      /PUT \/drives\/x: 400 \{"fault_message":"no such device"\}/
    )
    return true
  })
})

test('a socket that is not there fails the call rather than hanging', async t => {
  const where = mkdtempSync(out_path('fc-gone-'))
  t.after(() => rmSync(where, { recursive: true, force: true }))
  await assert.rejects(
    new Api(join(where, 'nothing.sock')).put('/vm', { state: 'Paused' }),
    /PUT \/vm: .*(ENOENT|connect)/
  )
})

test('boot describes the kernel, both drives, the machine, and the tap, then starts', async () => {
  const api = fake_api()
  await boot(api, {
    kernel: '/opt/fc/vmlinux',
    disk: '/opt/fc/rootfs.ext4',
    tap: 'fc-tap1',
    mac: '06:00:AC:10:00:02',
    vcpus: 2,
    mib: 512
  })

  assert.deepEqual(
    api.calls.map(([, path]) => path),
    [
      '/boot-source',
      '/drives/rootfs',
      '/machine-config',
      '/network-interfaces/eth0',
      '/actions'
    ]
  )
  assert.deepEqual(api.calls[0][2], {
    kernel_image_path: '/opt/fc/vmlinux',
    boot_args: BOOT_ARGS
  })
  assert.deepEqual(api.calls[1][2], {
    drive_id: 'rootfs',
    path_on_host: '/opt/fc/rootfs.ext4',
    is_root_device: true,
    is_read_only: false
  })
  assert.deepEqual(api.calls[2][2], { vcpu_count: 2, mem_size_mib: 512 })
  assert.deepEqual(api.calls[3][2], {
    iface_id: 'eth0',
    host_dev_name: 'fc-tap1',
    guest_mac: '06:00:AC:10:00:02'
  })
  assert.deepEqual(api.calls.at(-1)[2], { action_type: 'InstanceStart' })
})

test('boot attaches each read-only drive and only asks for huge pages when told', async () => {
  const api = fake_api()
  await boot(api, {
    kernel: 'k',
    disk: 'd',
    tap: 't',
    mac: 'm',
    vcpus: 1,
    mib: 96,
    huge_pages: '2M',
    readOnly: { code: '/opt/fc/code.ext4', app: '/opt/fc/app.ext4' }
  })

  const drives = api.calls.filter(([, path]) => path.startsWith('/drives/'))
  assert.deepEqual(
    drives.map(([, path, body]) => [path, body.drive_id, body.is_read_only]),
    [
      ['/drives/rootfs', 'rootfs', false],
      ['/drives/code', 'code', true],
      ['/drives/app', 'app', true]
    ]
  )
  assert.equal(
    api.calls.find(([, path]) => path === '/machine-config')[2].huge_pages,
    '2M'
  )
})

test('boot wires the vsock only when there is one', async () => {
  const without = fake_api()
  await boot(without, {
    kernel: 'k',
    disk: 'd',
    tap: 't',
    mac: 'm',
    vcpus: 1,
    mib: 96
  })
  assert.equal(
    without.calls.some(([, path]) => path === '/vsock'),
    false
  )

  const with_uds = fake_api()
  await boot(with_uds, {
    kernel: 'k',
    disk: 'd',
    tap: 't',
    mac: 'm',
    cid: 3,
    uds: '/run/actor.sock',
    vcpus: 1,
    mib: 96
  })
  assert.deepEqual(with_uds.calls.find(([, path]) => path === '/vsock')[2], {
    guest_cid: 3,
    uds_path: '/run/actor.sock'
  })
})

test('pause, createSnapshot, and loadSnapshot send the shapes Firecracker wants', async () => {
  const api = fake_api()
  await pause(api)
  await createSnapshot(api, '/run/state', '/run/mem')
  await loadSnapshot(
    api,
    '/run/state',
    '/run/mem',
    'fc-tap2',
    '/run/actor.sock'
  )

  assert.deepEqual(api.calls[0], ['PATCH', '/vm', { state: 'Paused' }])
  assert.deepEqual(api.calls[1], [
    'PUT',
    '/snapshot/create',
    {
      snapshot_type: 'Full',
      snapshot_path: '/run/state',
      mem_file_path: '/run/mem'
    }
  ])
  assert.deepEqual(api.calls[2], [
    'PUT',
    '/snapshot/load',
    {
      snapshot_path: '/run/state',
      mem_backend: { backend_path: '/run/mem', backend_type: 'File' },
      network_overrides: [{ iface_id: 'eth0', host_dev_name: 'fc-tap2' }],
      vsock_override: { uds_path: '/run/actor.sock' },
      resume_vm: true
    }
  ])
})

test('loadSnapshot leaves the vsock alone for a VM that has none', async () => {
  const api = fake_api()
  await loadSnapshot(api, '/run/state', '/run/mem', 'fc-tap2')
  const [, , body] = api.calls[0]
  assert.equal('vsock_override' in body, false)
  assert.equal(body.resume_vm, true)
})
