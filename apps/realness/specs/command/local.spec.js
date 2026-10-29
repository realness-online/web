import { it } from 'node:test'
import { environment_settings } from '#root/src/settings/environments.js'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  readFileSync as read_file_sync,
  existsSync as exists_sync
} from 'node:fs'
import { rm } from 'node:fs/promises'
import { sync_dir } from '../../src/settings/output.js'
import { randomUUID as random_uuid } from 'node:crypto'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer as create_server } from 'node:http'
import { fileURLToPath as file_url_to_path } from 'node:url'
import {
  local_plan,
  local_request,
  probe_local,
  start_local,
  local_artifacts,
  refresh_host_name
} from '../../src/command/local-stack.js'

/**
 * A host with no certificate, so the plan does not depend on this machine's
 * lc3 state; and no refresh, so no spec ever touches real DNS or certificates.
 */
process.env.REALNESS_HOST = 'spec-no-cert'
process.env.REALNESS_HOST_REFRESH = 'off'
const root = file_url_to_path(new URL('../../../../', import.meta.url))
const entry = file_url_to_path(
  new URL('../../../../.pi/bin/harness/local.js', import.meta.url)
)

const fixture = (running = []) => {
  const services = local_plan().services
  const ready = new Set(running)
  const launched = []
  const stopped = []
  const options = {
    probe: async service => ({
      running: ready.has(service.name),
      ready: ready.has(service.name)
    }),
    launch: async service => {
      launched.push(service.name)
      ready.add(service.name)
      if (service.persistent) service.exited = true
      return { pid: 100 + launched.length }
    },
    stop: async (child, service) => {
      stopped.push(service.name)
    }
  }
  return { services, launched, stopped, options }
}

it('one command works from another directory and leaves npm start as the harness entry', () => {
  const result = spawn_sync(
    'npm',
    ['--prefix', root, 'run', '--silent', 'local', '--', '--dry-run'],
    { cwd: root + 'apps/realness/docs', encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.deepEqual(
    plan.services.map(service => service.name),
    ['sign-in', 'sync', 'halo', 'proxy', 'workers', 'gate', 'frontend']
  )
  assert.ok(
    plan.services.every(service => service.cwd === root + 'apps/realness/')
  )
  const { scripts } = JSON.parse(
    read_file_sync(new URL('../../../../package.json', import.meta.url), 'utf8')
  )
  assert.equal(scripts.start, './.pi/bin/pi')
  assert.equal(scripts.local, 'node .pi/bin/harness/local.js')
  assert.equal(
    plan.services.find(service => service.name === 'gate').env.GATE_API_PORT,
    '18080'
  )
  const sync = plan.services.find(service => service.name === 'sync')
  assert.equal(sync.env.STORE, 'disk')
  assert.equal(sync.env.SYNC_DIR, sync_dir())
  const proxy = plan.services.find(service => service.name === 'proxy')
  assert.equal(proxy.env.STORE, 'disk')
  assert.ok(proxy.env.PROXY_DIR.includes('artifacts'))
  assert.equal(proxy.env.PINS_DIR, sync_dir())
  assert.equal(
    plan.services.find(service => service.name === 'gate').env.PINS_DIR,
    sync_dir()
  )
  assert.match(proxy.env.ORIGINS, /http:\/\/localhost:5173/)
  assert.doesNotMatch(proxy.env.ORIGINS, /realness\.local/)
  const gate = plan.services.find(service => service.name === 'gate')
  assert.deepEqual(gate.args.slice(-2), ['--environment', 'local'])
  assert.equal(gate.env.SYNC_URL, undefined)
  assert.equal(
    environment_settings('local').services.sync_url,
    `http://127.0.0.1:${new URL(sync.url).port}`
  )
  const frontend = plan.services.find(service => service.name === 'frontend')
  assert.deepEqual(frontend.args, [
    'run',
    'dev:frontend',
    '--',
    '--mode',
    'dev-local'
  ])
  assert.equal(frontend.env, undefined)
  assert.equal(new URL(frontend.url).hostname, '127.0.0.1')
  assert.ok(!result.stdout.includes('HALO_PASS_SECRET'))
})

it('starts existing service commands and stops only its children in reverse order', async () => {
  const { services, launched, stopped, options } = fixture()
  const cleanup = await start_local(services, options)
  assert.deepEqual(launched, [
    'sign-in',
    'sync',
    'halo',
    'proxy',
    'workers',
    'gate',
    'frontend'
  ])
  assert.ok(services.every(service => service.state === 'running'))
  await cleanup()
  assert.deepEqual(stopped, [
    'frontend',
    'gate',
    'workers',
    'proxy',
    'sync',
    'sign-in'
  ])
})

it('a slow halo does not hold the other services back', async () => {
  const { services, stopped, options } = fixture()
  const seen = []
  let halo_reads = 0
  const probe = options.probe
  options.probe = async service =>
    service.name === 'halo'
      ? { running: true, ready: ++halo_reads > 3 }
      : probe(service)
  options.pause = async () => {}
  const cleanup = await start_local(services, {
    ...options,
    changed: service => seen.push(`${service.name}:${service.state}`)
  })
  await cleanup()
  assert.ok(
    seen.indexOf('frontend:running') < seen.indexOf('halo:running'),
    seen.join(' ')
  )
  assert.deepEqual(stopped, [
    'frontend',
    'gate',
    'workers',
    'proxy',
    'sync',
    'sign-in'
  ])
})

it('never restarts or stops an already running service', async () => {
  const { services, launched, stopped, options } = fixture([
    'sign-in',
    'sync',
    'halo',
    'proxy',
    'workers',
    'gate',
    'frontend'
  ])
  const cleanup = await start_local(services, options)
  await cleanup()
  assert.deepEqual(launched, [])
  assert.deepEqual(stopped, [])
  assert.ok(services.every(service => service.reused))
})

it('waits for an existing halo to finish becoming ready without starting another', async () => {
  const { services, launched, options } = fixture([
    'sign-in',
    'sync',
    'proxy',
    'workers',
    'gate',
    'frontend'
  ])
  let halo_reads = 0
  const original = options.probe
  options.probe = async service =>
    service.name === 'halo'
      ? { running: true, ready: ++halo_reads > 2 }
      : original(service)
  options.pause = async () => {}
  const cleanup = await start_local(services, options)
  await cleanup()
  assert.deepEqual(launched, [])
  assert.equal(halo_reads, 3)
})

it('an occupied port fails before any processes are started', async () => {
  const { services, launched, stopped, options } = fixture()
  options.probe = async service => {
    if (service.name === 'frontend') throw new Error('another gate')
    return { running: false, ready: false }
  }
  await assert.rejects(start_local(services, options), /another gate/)
  assert.deepEqual(launched, [])
  assert.deepEqual(stopped, [])
})

it('startup failure cleans up earlier children and leaves reused services alone', async () => {
  const { services, launched, stopped, options } = fixture(['halo'])
  const original = options.launch
  options.launch = async service => {
    if (service.name === 'gate') throw new Error('gate cannot start')
    return original(service)
  }
  await assert.rejects(start_local(services, options), /gate cannot start/)
  assert.deepEqual(launched, ['sign-in', 'sync', 'proxy', 'workers'])
  assert.deepEqual(stopped, ['workers', 'proxy', 'sync', 'sign-in'])
})

it('cancellation during startup cleans up only owned processes', async () => {
  const { services, stopped, options } = fixture(['halo'])
  const controller = new AbortController()
  const original = options.launch
  options.launch = async service => {
    const child = await original(service)
    controller.abort()
    return child
  }
  await assert.rejects(
    start_local(services, { ...options, signal: controller.signal }),
    { name: 'AbortError' }
  )
  assert.deepEqual(stopped, ['sign-in'])
})

it('a child that exits during startup cannot be reported as ready', async () => {
  const { services, stopped, options } = fixture(['halo'])
  const original = options.launch
  options.launch = async service => {
    const child = await original(service)
    service.error = `${service.name} exited`
    return child
  }
  await assert.rejects(start_local(services, options), /exited/)
  assert.deepEqual(stopped, ['sync', 'sign-in'])
})

it(
  'real cleanup stops the owned parent and its grandchild by process group',
  { timeout: 10_000 },
  async context => {
    const record = path.join(local_artifacts, `test-${random_uuid()}.json`)
    const service = {
      name: 'cleanup-test',
      command: process.execPath,
      args: [
        file_url_to_path(
          new URL('./fixtures/local-process.js', import.meta.url)
        ),
        record
      ],
      cwd: root
    }
    let cleanup
    try {
      cleanup = await start_local([service], {
        signal: context.signal,
        probe: async () => ({
          running: exists_sync(record),
          ready: exists_sync(record)
        })
      })
      const { parent, child } = JSON.parse(read_file_sync(record, 'utf8'))
      await cleanup()
      cleanup = null
      const gone = pid => {
        try {
          process.kill(pid, 0)
          return false
        } catch (error) {
          if (error.code === 'ESRCH') return true
          throw error
        }
      }
      const deadline = Date.now() + 2000
      while (!gone(child) && Date.now() < deadline) await delay(50)
      assert.equal(gone(parent), true)
      assert.equal(gone(child), true)
    } finally {
      await cleanup?.()
      await rm(record, { force: true })
    }
  }
)

it('the public entry rejects unknown flags without starting the stack', () => {
  const result = spawn_sync(process.execPath, [entry, '--unexpected'], {
    encoding: 'utf8'
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /usage:/)
})

it('readiness reads a real HTTP endpoint and distinguishes connection refusal', async () => {
  const server = create_server((request, response) => response.end('ok\n'))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/health`
  try {
    const { status, body, headers } = await local_request(url)
    assert.deepEqual({ status, body }, { status: 200, body: 'ok\n' })
    assert.equal(headers['content-length'], '3')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
  assert.equal(await local_request(url), null)
})

it('frontend reuse checks the running Vite mode without restarting it', async context => {
  let mode = 'dev-local'
  const server = create_server((request, response) => {
    response.setHeader('X-Vite-Mode', mode)
    response.end('<script type="module" src="/@vite/client"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise(resolve => server.close(resolve)))
  const service = {
    name: 'frontend',
    url: `http://127.0.0.1:${server.address().port}`
  }
  assert.deepEqual(await probe_local(service), { running: true, ready: true })
  mode = 'development'
  await assert.rejects(probe_local(service), /another gate/)
})

it('lc3: REALNESS_HOST_REFRESH=off never reaches DNS or certificates', async () => {
  const notes = []
  assert.equal(
    await refresh_host_name(note => notes.push(note), {
      REALNESS_HOST_REFRESH: 'off'
    }),
    null
  )
  assert.deepEqual(notes, [])
})
