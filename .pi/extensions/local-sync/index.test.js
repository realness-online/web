import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  claim_session,
  close_server,
  drop_start,
  ensure_server,
  live_sessions,
  local_sync,
  read_server,
  release_session,
  take_start,
  write_server
} from './index.js'

const harness = fileURLToPath(new URL('../../..', import.meta.url))
const scratch = join(harness, 'artifacts', `local-sync-test-${process.pid}`)

after(() => rmSync(scratch, { recursive: true, force: true }))

/** Fresh state folders: one session marker, the server record, the start lock. */
const paths = () => {
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(join(scratch, 'sessions'), { recursive: true })
  return {
    sessions: join(scratch, 'sessions'),
    record: join(scratch, 'server.json'),
    starting: join(scratch, 'starting')
  }
}

/** A process table the test controls, so no real process is signalled. */
const table = (...pids) => {
  const live = new Set(pids)
  return { live, alive_fn: pid => live.has(pid) }
}

test('live_sessions lists open sessions and removes dead markers', () => {
  const { sessions } = paths()
  const { alive_fn } = table(11)
  claim_session(11, sessions)
  claim_session(12, sessions)
  assert.deepEqual(live_sessions(sessions, alive_fn), [11])
  assert.equal(existsSync(join(sessions, '12.json')), false)
  release_session(11, sessions)
  assert.deepEqual(live_sessions(sessions, alive_fn), [])
})

test('no open session starts nothing', async () => {
  const where = paths()
  let launched = 0
  const outcome = await ensure_server({
    ...where,
    up: async () => false,
    launch: () => ((launched += 1), { pid: 900 })
  })
  assert.equal(outcome, 'no session')
  assert.equal(launched, 0)
})

test('the first session starts the server and records it', async () => {
  const where = paths()
  const { alive_fn } = table(11, 900)
  claim_session(11, where.sessions)
  let up = false
  const outcome = await ensure_server({
    ...where,
    alive_fn,
    up: async () => up,
    launch: () => ((up = true), { pid: 900 })
  })
  assert.equal(outcome, 'started')
  assert.equal(read_server(where.record, alive_fn), 900)
  assert.equal(existsSync(where.starting), false)
})

test('a running server is not started twice', async () => {
  const where = paths()
  const { alive_fn } = table(11)
  claim_session(11, where.sessions)
  let launched = 0
  const outcome = await ensure_server({
    ...where,
    alive_fn,
    up: async () => true,
    launch: () => ((launched += 1), { pid: 900 })
  })
  assert.equal(outcome, 'running')
  assert.equal(launched, 0)
  assert.equal(existsSync(where.record), false)
})

test('a second session waits for a start already under way', async () => {
  const where = paths()
  const { alive_fn } = table(11, 12)
  claim_session(11, where.sessions)
  claim_session(12, where.sessions)
  writeFileSync(where.starting, '12')
  let launched = 0
  const outcome = await ensure_server({
    ...where,
    alive_fn,
    up: async () => false,
    launch: () => ((launched += 1), { pid: 900 })
  })
  assert.equal(outcome, 'starting')
  assert.equal(launched, 0)
})

test('a start lock a dead process left is taken over', () => {
  const where = paths()
  const { alive_fn } = table(13)
  writeFileSync(where.starting, '12')
  assert.equal(take_start(where.starting, 13, alive_fn), true)
  assert.equal(take_start(where.starting, 14, alive_fn), false)
  drop_start(where.starting, 13)
  assert.equal(existsSync(where.starting), false)
})

test('the last session stops the server, earlier ones leave it', async () => {
  const where = paths()
  const { live, alive_fn } = table(11, 12, 900)
  claim_session(11, where.sessions)
  claim_session(12, where.sessions)
  write_server(where.record, 900)
  const stopped = []
  const stop = pid => stopped.push(pid)

  release_session(11, where.sessions)
  assert.equal(await close_server({ ...where, alive_fn, stop }), 'still open')
  assert.deepEqual(stopped, [])

  release_session(12, where.sessions)
  assert.equal(await close_server({ ...where, alive_fn, stop }), 'stopped')
  assert.deepEqual(stopped, [900])
  assert.equal(existsSync(where.record), false)
  assert.equal(live.has(900), true)
})

test('a server this harness did not start stays up', async () => {
  const where = paths()
  const { alive_fn } = table(900)
  const stopped = []
  assert.equal(await close_server({ ...where, alive_fn, stop: pid => stopped.push(pid) }), 'not running')
  assert.deepEqual(stopped, [])
})

test('a reload keeps the claim, a quit releases it and stops the server', async () => {
  const where = paths()
  const { live, alive_fn } = table(11, 900)
  const handlers = {}
  const stopped = []
  let up = false
  local_sync(
    { on: (name, fn) => (handlers[name] = fn) },
    {
      pid: 11,
      paths: where,
      alive_fn,
      up: async () => up,
      launch: () => ((up = true), { pid: 900 }),
      stop: pid => stopped.push(pid),
      tries: 1,
      wait_ms: 1
    }
  )

  await handlers.session_start()
  assert.deepEqual(live_sessions(where.sessions, alive_fn), [11])
  assert.equal(read_server(where.record, alive_fn), 900)

  await handlers.session_shutdown({ reason: 'reload' })
  assert.deepEqual(live_sessions(where.sessions, alive_fn), [11])
  assert.deepEqual(stopped, [])

  live.add(900)
  write_server(where.record, 900)
  await handlers.session_shutdown({ reason: 'quit' })
  assert.deepEqual(live_sessions(where.sessions, alive_fn), [])
  assert.deepEqual(stopped, [900])
})

test('a server that never answers is not recorded', async () => {
  const where = paths()
  const { alive_fn } = table(11)
  claim_session(11, where.sessions)
  const outcome = await ensure_server({
    ...where,
    alive_fn,
    up: async () => false,
    launch: () => ({ pid: 901 }),
    tries: 2,
    wait_ms: 1
  })
  assert.equal(outcome, 'failed')
  assert.equal(existsSync(where.record), false)
  assert.equal(existsSync(where.starting), false)
})
