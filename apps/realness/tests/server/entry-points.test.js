import assert from 'node:assert/strict'
import { spawn, spawnSync as spawn_sync } from 'node:child_process'
import { mkdtempSync as mkdtemp_sync, mkdirSync as mkdir_sync, rmSync as rm_sync } from 'node:fs'
import { createServer as create_server } from 'node:net'
import { once } from 'node:events'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { out_path } from '#root/lib/output.js'
import * as proxy from '#root/server/proxy/index.js'

const project = resolve(import.meta.dirname, '../..')
const entry = path => join(project, path)

const free_port = async () => {
  const server = create_server().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  server.close()
  return port
}

/**
 * Start a service the way its deploy does and wait for the line saying it
 * listens. The process is stopped by its own PID when the test ends.
 */
const start = async (t, path, { args = [], env = {}, ready }) => {
  const child = spawn(process.execPath, [entry(path), ...args], {
    cwd: project,
    env: { ...process.env, LISTEN: '127.0.0.1', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  t.after(() => child.kill())
  let said = ''
  for await (const chunk of child.stdout) {
    said += chunk
    if (ready.test(said)) return said
  }
  throw new Error(`${path} stopped before it was ready`)
}

const scratch = t => {
  mkdir_sync(out_path('tests'), { recursive: true })
  const dir = mkdtemp_sync(join(out_path('tests'), 'entry-'))
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  return dir
}

test('the sync service starts in dev mode on disk and answers health', async t => {
  const port = await free_port()
  const said = await start(t, 'server/sync/bin/sync-service.js', {
    args: ['--dev'],
    env: { PORT: String(port), STORE: 'disk', SYNC_DIR: scratch(t) },
    ready: /sync service on/
  })
  assert.match(said, /export A=/)
  const response = await fetch(`http://127.0.0.1:${port}/v1/health`)
  assert.ok(response.status < 500, `health answered ${response.status}`)
})

test('the sync service refuses an unknown store or a bucket-less gcs', () => {
  const unknown = spawn_sync(process.execPath, [entry('server/sync/bin/sync-service.js'), '--dev'], {
    env: { ...process.env, STORE: 'tape' },
    encoding: 'utf8'
  })
  assert.notEqual(unknown.status, 0)
  assert.match(unknown.stderr, /unknown STORE=tape/)
  const gcs = spawn_sync(process.execPath, [entry('server/sync/bin/sync-service.js'), '--dev'], {
    env: { ...process.env, STORE: 'gcs', GCS_BUCKET: '' },
    encoding: 'utf8'
  })
  assert.match(gcs.stderr, /STORE=gcs needs GCS_BUCKET/)
})

test('the gate needs its secret, then listens', async t => {
  const missing = spawn_sync(process.execPath, [entry('server/gate/bin/gate-service.js')], {
    env: { ...process.env, HOST_PASS_SECRET: '' },
    encoding: 'utf8'
  })
  assert.match(missing.stderr, /gate needs HOST_PASS_SECRET/)
  const port = await free_port()
  await start(t, 'server/gate/bin/gate-service.js', {
    env: {
      PORT: String(port),
      HOST_PASS_SECRET: 'entry-test-secret-at-least-thirty-two',
      GATE_HOST: '127.0.0.1:1',
      IDENTITY_PROJECT: 'entry-test',
      PINS_BUCKET: 'entry-test'
    },
    ready: /gate on 127\.0\.0\.1/
  })
})

test('the proxy listens and refuses an unsigned model call', async t => {
  const port = await free_port()
  await start(t, 'server/proxy/bin/proxy-service.js', {
    env: { PORT: String(port), PINS_BUCKET: 'entry-test', MODEL_PASS_SECRET: 'entry-test-secret-at-least-thirty-two', STRIPE_SECRET_KEY: '' },
    ready: /proxy on 127\.0\.0\.1/
  })
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: 'POST', body: '{}' })
  assert.equal(response.status, 401)
})

test('the proxy package exports its service and upstream call', () => {
  assert.equal(typeof proxy.agent_service, 'function')
  assert.equal(typeof proxy.call_upstream, 'function')
})

test('the brayness commands print usage through their entry points', () => {
  const help = spawn_sync(process.execPath, [entry('server/sync/bin/brayness.js'), '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0, help.stderr)
  assert.match(help.stdout, /^usage: realness sync/)
  const store = spawn_sync(process.execPath, [entry('server/sync/bin/brayness-store.js'), 'nonsense'], { encoding: 'utf8' })
  assert.equal(store.status, 2)
  assert.match(store.stderr, /usage: realness login\|logout/)
})

test('the host app command names its usage', () => {
  const result = spawn_sync(process.execPath, [entry('server/host/app.js')], { encoding: 'utf8' })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /usage: app\.js start <files-dir> \| stop <id>/)
})

test('the host main and login client name their usage', () => {
  const host = spawn_sync(process.execPath, [entry('server/host/main.js')], { encoding: 'utf8' })
  assert.equal(host.status, 2)
  assert.match(host.stderr, /usage: main\.js serve\|seed/)
  const login = spawn_sync(process.execPath, [entry('server/host/clients/login.js'), '--help'], { encoding: 'utf8' })
  assert.equal(login.status, 0, login.stderr)
  assert.match(login.stdout, /usage: login\.js --phone \+E164/)
  const no_phone = spawn_sync(process.execPath, [entry('server/host/clients/login.js')], { encoding: 'utf8' })
  assert.notEqual(no_phone.status, 0)
  assert.match(no_phone.stderr, /--phone is required/)
})
