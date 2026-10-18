import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { registerHooks } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const state = (globalThis.startup_timing_test = {
  clock: 0,
  calls: [],
  guest_argv: [],
  running: false
})
const modules = {
  'node:perf_hooks':
    'export const performance = { now: () => globalThis.startup_timing_test.clock }',
  'firecracker.js': `
    const state = globalThis.startup_timing_test
    export const version = () => "test"
    export const spawn = () => { state.clock += 10; state.running = true; return { pid: 123 } }
    export const waitForApiSocket = async () => { state.clock += 20 }
    export class Api {}
    export const loadSnapshot = async () => { state.clock += 30; state.calls.push("snapshot") }
    export const boot = async () => { state.clock += 60; state.calls.push("boot") }
    export const pidForApiSock = () => state.running ? 123 : null
    export const terminate = async () => { state.running = false }
    export const pause = async () => { state.calls.push("pause") }
    export const createSnapshot = async () => { state.calls.push("save snapshot") }
  `,
  'syscalls.js': `
    import { copyFileSync } from "node:fs"
    export const requireRoot = () => {}
    export const requireMount = () => {}
    export const shortEnoughForUnix = () => true
    export const run = argv => { if (argv[0] === "cp") copyFileSync(argv[2], argv[3]); return { code: 0, output: "" } }
    export const freeTap = () => {
      const state = globalThis.startup_timing_test
      if (state.no_tap) throw new state.HaloError("no free TAP in fc-tap1..254")
      return "fc-tap1"
    }
    export const createTap = () => {}
    export const deleteTap = () => {}
    export const ensureTap = () => false
    export const tapGuest = () => "172.16.1.2"
  `,
  'door.js': `
    export const wait_for_door = async () => { globalThis.startup_timing_test.clock += 11; return true }
  `,
  'vsock.js': `
    const state = globalThis.startup_timing_test
    export const VSOCK_PORT = 52
    export const waitForAgent = async () => {
      state.clock += 40
      if (state.fail_agent) throw new Error("guest unavailable")
    }
    export const execInGuest = async (_, argv) => {
      state.guest_argv.push(argv)
      state.clock += 50
      return { code: argv.includes("/usr/local/bin/realness-recover") ? state.recover_code : argv.includes("start-pi") ? state.pi_code : 0, out: Buffer.from("ready"), err: Buffer.alloc(0) }
    }
    export const runOk = async () => { state.clock += 5; return "machine actor boot 1" }
  `
}
const hooks = registerHooks({
  resolve(specifier, context, next) {
    const key =
      specifier === 'node:perf_hooks' ? specifier : specifier.split('/').at(-1)
    if (
      context.parentURL?.endsWith('/src/halo/actors.js') &&
      Object.hasOwn(modules, key)
    ) {
      return {
        url: `data:text/javascript,${encodeURIComponent(modules[key])}`,
        shortCircuit: true
      }
    }
    return next(specifier, context)
  }
})
const { ActorStore } = await import('../../src/halo/actors.js')
hooks.deregister()
const { Full, HaloError } = await import('../../src/halo/errors.js')
state.HaloError = HaloError

const scratch = fileURLToPath(
  new URL(
    '../../../../artifacts/realness-halo-scale/test-data/',
    import.meta.url
  )
)
mkdirSync(scratch, { recursive: true })

const fixture = t => {
  state.clock = 0
  state.calls = []
  state.guest_argv = []
  state.running = false
  state.fail_agent = false
  state.recover_code = 0
  state.pi_code = 0
  state.no_tap = false
  const volume = mkdtempSync(join(scratch, 'timing-'))
  t.after(() => rmSync(volume, { recursive: true, force: true }))
  const store = new ActorStore({ volume, firecracker: 'test' })
  mkdirSync(store.seedDir)
  writeFileSync(join(store.seedDir, 'rootfs.ext4'), 'disk')
  store.ensureSeed = async () => {
    state.clock += 7
    return { matches: true }
  }
  return store
}

const fields = (store, id, event) => {
  const trace = store.traceOf(id).find(row => row.event === event)
  assert.ok(trace, `${event} trace exists`)
  return Object.fromEntries(
    ['vm_ms', 'agent_ms', 'init_ms', 'ms'].map(key => [key, trace[key]])
  )
}

test('create separates VM load, guest response, initialization, and total', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  assert.deepEqual(fields(store, actor.id, 'create'), {
    vm_ms: 60,
    agent_ms: 40,
    init_ms: 55,
    ms: 162
  })
  assert.deepEqual(state.calls, ['snapshot'])
})

test('recovery defers Pi through an actor-init argument', async t => {
  const store = fixture(t)
  store.syncUrl = 'https://sync.test'
  await store.create('+14156667777')
  const argv = state.guest_argv.find(args =>
    args.includes('/usr/local/bin/realness-actor-init')
  )
  assert.equal(argv[0], '/usr/local/bin/realness-actor-init')
  assert.equal(argv.at(-1), '--after-recovery')
})

for (const from_memory of [true, false]) {
  test(`temporary reconnect cold-boots ${from_memory ? 'despite existing user snapshots' : 'without user snapshots'}`, async t => {
    const store = fixture(t)
    const actor = await store.create('+14156667777')
    if (from_memory) {
      writeFileSync(join(actor.dir, 'state'), 'snapshot')
      writeFileSync(join(actor.dir, 'mem'), 'memory')
    }
    state.running = false
    state.calls = []
    const restored = await store.reload(actor.id)
    const vm_ms = 90
    assert.deepEqual(fields(store, restored.id, 'reload'), {
      vm_ms,
      agent_ms: 40,
      init_ms: 55,
      ms: vm_ms + 95
    })
    assert.equal(
      store.traceOf(actor.id).find(row => row.event === 'reload').from_memory,
      false
    )
    assert.deepEqual(state.calls, ['boot'])
  })
}

test('z12: a cold reconnect starts Pi as its own stage, after initialization', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  const completed = store
    .traceOf(actor.id)
    .filter(
      event => event.event === 'startup-stage' && event.state === 'complete'
    )
  assert.deepEqual(
    completed.map(event => [event.stage, event.ms]),
    [
      ['checking_seed', 7],
      ['starting_actor', 60],
      ['waiting_guest', 40],
      ['initializing_actor', 55]
    ]
  )
  assert.equal(new Set(completed.map(event => event.startup_id)).size, 1)
  assert.equal(completed.at(-1).elapsed_ms, 162)
  assert.ok(
    !JSON.stringify(actor).includes('startup'),
    'internal tracker never becomes actor data'
  )
  state.running = false
  await store.reload(actor.id)
  const events = store
    .traceOf(actor.id)
    .filter(
      event => event.event === 'startup-stage' && event.state === 'complete'
    )
  const reconnect = events.slice(completed.length)
  assert.deepEqual(
    reconnect.map(event => [event.stage, event.ms]),
    [
      ['starting_actor', 90],
      ['waiting_guest', 40],
      ['initializing_actor', 55],
      ['starting_pi', 50]
    ]
  )
  assert.notEqual(reconnect[0].startup_id, completed[0].startup_id)
  assert.equal(reconnect.at(-1).elapsed_ms, 235)
})

test('live progress keeps one request ID through recovery and includes queued time', async t => {
  const store = fixture(t)
  store.syncUrl = 'https://sync.test'
  state.clock = 5000
  const events = []
  const actor = await store.create('+14156667777', {
    startup: {
      id: 'request-startup',
      started_at: 0,
      report: event => events.push(event)
    }
  })
  assert.equal(events[0].elapsed_ms, 5000)
  assert.equal(events.at(-1).elapsed_ms, 5278)
  assert.ok(
    events.every(
      event =>
        event.startup_id === 'request-startup' && event.actor_id === actor.id
    )
  )
  assert.equal(
    events.find(
      event => event.stage === 'starting_pi' && event.state === 'complete'
    ).ms,
    50
  )
  const traced = store
    .traceOf(actor.id)
    .filter(event => event.event === 'startup-stage')
  assert.equal(traced.length, events.length)
  assert.ok(traced.every(event => event.startup_id === 'request-startup'))
  state.running = false
  const reconnect = []
  await store.ensureRunning(actor.id, {
    startup: {
      id: 'reconnect-startup',
      started_at: state.clock - 100,
      report: event => reconnect.push(event)
    }
  })
  assert.equal(reconnect[0].elapsed_ms, 100)
  assert.ok(reconnect.every(event => event.startup_id === 'reconnect-startup'))
})

test('file recovery and Pi launch have separate durations', async t => {
  const store = fixture(t)
  store.syncUrl = 'https://sync.test'
  const actor = await store.create('+14156667777')
  const events = store.traceOf(actor.id)
  const completed = events.filter(
    event => event.event === 'startup-stage' && event.state === 'complete'
  )
  assert.deepEqual(
    completed.slice(-2).map(event => [event.stage, event.ms]),
    [
      ['restoring_files', 66],
      ['starting_pi', 50]
    ]
  )
  assert.equal(new Set(completed.map(event => event.startup_id)).size, 1)
  assert.equal(events.find(event => event.event === 'pi-start').ms, 50)
  assert.equal(completed.at(-1).elapsed_ms, 278)
})

test('failed recovery is visible while Pi still launches', async t => {
  const store = fixture(t)
  store.syncUrl = 'https://sync.test'
  state.recover_code = 1
  const actor = await store.create('+14156667777')
  const stages = store
    .traceOf(actor.id)
    .filter(
      event => event.event === 'startup-stage' && event.state !== 'starting'
    )
  assert.deepEqual(
    stages.slice(-2).map(event => [event.stage, event.state]),
    [
      ['restoring_files', 'failed'],
      ['starting_pi', 'complete']
    ]
  )
})

test('failed guest readiness records failure, not initialization success', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  state.running = false
  state.fail_agent = true
  await assert.rejects(store.reload(actor.id), /guest unavailable/)
  const event = store
    .traceOf(actor.id)
    .filter(event => event.event === 'startup-stage')
    .at(-1)
  assert.equal(event.stage, 'waiting_guest')
  assert.equal(event.state, 'failed')
  assert.equal(event.ms, 40)
})

test('temporary idle skips user snapshot creation and preserves the disk', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  state.calls = []
  await store.idle(actor.id)
  assert.deepEqual(state.calls, ['pause'])
  assert.equal(state.running, false)
  assert.equal(existsSync(join(actor.dir, 'state')), false)
  assert.equal(readFileSync(join(actor.dir, 'rootfs.ext4'), 'utf8'), 'disk')
})

test('reconnect queues behind shutdown while the actor still appears running', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  let release
  const blocked = store.lock.run(
    () =>
      new Promise(done => {
        release = done
      })
  )
  await new Promise(done => setImmediate(done))
  let resumed = false
  const reconnect = Promise.resolve(store.ensureRunning(actor.id)).then(() => {
    resumed = true
  })
  await new Promise(done => setImmediate(done))
  assert.equal(resumed, false)
  release()
  await blocked
  await reconnect
  assert.equal(resumed, true)
})

test('lock queue time is excluded from actor creation time', async t => {
  const store = fixture(t)
  store.lock.run = work => {
    state.clock += 1000
    return work()
  }
  const actor = await store.create('+14156667777')
  assert.equal(fields(store, actor.id, 'create').ms, 162)
})

test('failed guest startup does not produce a successful create measurement', async t => {
  const store = fixture(t)
  state.fail_agent = true
  await assert.rejects(store.create('+14156667777'), /guest unavailable/)
  assert.equal(store.list().length, 0)
  assert.equal(state.running, false)
})

test('failed guest restore does not produce a successful reload measurement', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  writeFileSync(join(actor.dir, 'state'), 'snapshot')
  writeFileSync(join(actor.dir, 'mem'), 'memory')
  state.running = false
  state.fail_agent = true
  await assert.rejects(store.reload(actor.id), /guest unavailable/)
  assert.equal(
    store.traceOf(actor.id).filter(row => row.event === 'reload').length,
    0
  )
  assert.equal(state.running, false)
})

test('already running actors do not produce a restore measurement', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  await store.reload(actor.id)
  assert.equal(
    store.traceOf(actor.id).filter(row => row.event === 'reload').length,
    0
  )
})

const GIB = 1024 ** 3
const created_dirs = store =>
  readdirSync(store.volume).filter(name => name.startsWith('a-'))

test('hs-over: a create past free memory fails clearly before any disk or TAP', async t => {
  const store = fixture(t)
  store.memAvailable = () => 2.25 * GIB
  await assert.rejects(store.create('+14156667777'), error => {
    assert.ok(error instanceof Full)
    assert.match(error.message, /^halo full: 2\.25 GiB free, 2\.75 GiB needed/)
    return true
  })
  assert.deepEqual(created_dirs(store), [])
  assert.deepEqual(state.calls, [])
})

test('hs-over: creates in flight hold their memory; a finished create gives it back', async t => {
  const store = fixture(t)
  store.memAvailable = () => 2.75 * GIB
  const first = store.create('+14156667777')
  await assert.rejects(store.create('+14156667777'), Full)
  await first
  await store.create('+14156667777')
  assert.equal(created_dirs(store).length, 2)
})

test('hs-over: unknown memory does not refuse', async t => {
  const store = fixture(t)
  store.memAvailable = () => null
  await store.create('+14156667777')
})

test('hs-over: the last TAP taken reads as a full halo', async t => {
  const store = fixture(t)
  store.memAvailable = () => 64 * GIB
  state.no_tap = true
  await assert.rejects(store.create('+14156667777'), error => {
    assert.ok(error instanceof Full)
    assert.match(error.message, /^halo full: no free TAP/)
    return true
  })
})

test('a failed Pi launch refuses startup instead of reporting success', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  state.running = false
  state.pi_code = 1
  await assert.rejects(store.reload(actor.id), /Pi did not start/)
  const stages = store
    .traceOf(actor.id)
    .filter(event => event.stage === 'starting_pi')
  assert.ok(stages.some(event => event.state === 'failed'))
  assert.ok(!stages.some(event => event.state === 'complete'))
})

test('z12: a reconnect leaves Pi to start-pi, so the opener is typed once', async t => {
  const store = fixture(t)
  const actor = await store.create('+14156667777')
  state.running = false
  state.guest_argv = []
  await store.reload(actor.id)
  const init = state.guest_argv.filter(args =>
    args.includes('/usr/local/bin/realness-actor-init')
  )
  assert.deepEqual(
    init.map(args => args.at(-1)),
    ['--after-recovery', 'start-pi']
  )
})
