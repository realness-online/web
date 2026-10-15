import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  readFileSync as read_file_sync,
  existsSync as exists_sync
} from 'node:fs'
import { rm } from 'node:fs/promises'
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
  local_artifacts
} from '../../src/command/local-stack.js'

const root = file_url_to_path(new URL('../../../../', import.meta.url))
const entry = file_url_to_path(
  new URL('../../../../bin/local.js', import.meta.url)
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

test('one command works from another directory and leaves npm start as the harness entry', () => {
  const result = spawn_sync(
    'npm',
    ['--prefix', root, 'run', '--silent', 'local', '--', '--dry-run'],
    { cwd: root + 'apps/realness/frontend', encoding: 'utf8' }
  )
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.deepEqual(
    plan.services.map(service => service.name),
    ['host', 'workers', 'gate', 'frontend']
  )
  assert.ok(
    plan.services.every(service => service.cwd === root + 'apps/realness/')
  )
  const { scripts } = JSON.parse(
    read_file_sync(new URL('../../../../package.json', import.meta.url), 'utf8')
  )
  assert.equal(scripts.start, './bin/pi')
  assert.equal(scripts.local, 'node bin/local.js')
  assert.equal(
    plan.services.find(service => service.name === 'gate').env.GATE_API_PORT,
    '18080'
  )
  const frontend = plan.services.find(service => service.name === 'frontend')
  assert.deepEqual(frontend.args, [
    'run',
    'dev:frontend',
    '--',
    '--mode',
    'local'
  ])
  assert.equal(frontend.env, undefined)
  assert.equal(new URL(frontend.url).hostname, '127.0.0.1')
  assert.ok(!result.stdout.includes('HOST_PASS_SECRET'))
})

test('starts existing service commands and stops only its children in reverse order', async () => {
  const { services, launched, stopped, options } = fixture()
  const cleanup = await start_local(services, options)
  assert.deepEqual(launched, ['host', 'workers', 'gate', 'frontend'])
  assert.ok(services.every(service => service.state === 'running'))
  await cleanup()
  assert.deepEqual(stopped, ['frontend', 'gate', 'workers'])
})

test('never restarts or stops an already running service', async () => {
  const { services, launched, stopped, options } = fixture([
    'host',
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

test('waits for an existing host to finish becoming ready without starting another', async () => {
  const { services, launched, options } = fixture([
    'workers',
    'gate',
    'frontend'
  ])
  let host_reads = 0
  const original = options.probe
  options.probe = async service =>
    service.name === 'host'
      ? { running: true, ready: ++host_reads > 2 }
      : original(service)
  options.pause = async () => {}
  const cleanup = await start_local(services, options)
  await cleanup()
  assert.deepEqual(launched, [])
  assert.equal(host_reads, 3)
})

test('an occupied port fails before any processes are started', async () => {
  const { services, launched, stopped, options } = fixture()
  options.probe = async service => {
    if (service.name === 'frontend') throw new Error('another gate')
    return { running: false, ready: false }
  }
  await assert.rejects(start_local(services, options), /another gate/)
  assert.deepEqual(launched, [])
  assert.deepEqual(stopped, [])
})

test('startup failure cleans up earlier children and leaves reused services alone', async () => {
  const { services, launched, stopped, options } = fixture(['host'])
  const original = options.launch
  options.launch = async service => {
    if (service.name === 'gate') throw new Error('gate cannot start')
    return original(service)
  }
  await assert.rejects(start_local(services, options), /gate cannot start/)
  assert.deepEqual(launched, ['workers'])
  assert.deepEqual(stopped, ['workers'])
})

test('cancellation during startup cleans up only owned processes', async () => {
  const { services, stopped, options } = fixture(['host'])
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
  assert.deepEqual(stopped, ['workers'])
})

test('a child that exits during startup cannot be reported as ready', async () => {
  const { services, stopped, options } = fixture(['host'])
  const original = options.launch
  options.launch = async service => {
    const child = await original(service)
    service.error = 'workers exited'
    return child
  }
  await assert.rejects(start_local(services, options), /workers exited/)
  assert.deepEqual(stopped, ['workers'])
})

test(
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

test('the public entry rejects unknown flags without starting the stack', () => {
  const result = spawn_sync(process.execPath, [entry, '--unexpected'], {
    encoding: 'utf8'
  })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /usage:/)
})

test('readiness reads a real HTTP endpoint and distinguishes connection refusal', async () => {
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

test('frontend reuse checks the running Vite mode without restarting it', async context => {
  let mode = 'local'
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
