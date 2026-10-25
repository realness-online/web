import assert from 'node:assert/strict'
import { it } from 'node:test'
import { ActorStore } from '../../src/halo/actors.js'
import { Parking } from '../../src/halo/errors.js'
import { PARK_AFTER_MS, Parker, park_blockers } from '../../src/halo/parking.js'
import { read_lifecycle } from '../../src/sync/halo-lifecycle.js'

const idle = { actors: 0, kinds: {} }

/** A halo with a fake store, mirror, and clock. */
const host = ({
  park = async () => ({ ok: true }),
  activity = () => idle,
  apps = 0,
  held = false
} = {}) => {
  let clock = Date.parse('2026-10-15T12:00:00Z')
  const seen = { intents: [], poweroffs: 0, reopened: 0 }
  const parker = new Parker({
    store: {
      activity,
      park,
      reopen: () => {
        seen.reopened += 1
      }
    },
    loops: { all: () => [] },
    apps_running: async () => apps,
    held: () => held,
    mirror: {
      put: async (key, body) => {
        assert.equal(key, 'halos/h1/lifecycle.html')
        seen.intents.push(read_lifecycle(body).intent)
      }
    },
    halo: 'h1',
    poweroff: async () => {
      seen.poweroffs += 1
    },
    now: () => clock
  })
  return {
    parker,
    seen,
    wait: ms => {
      clock += ms
    }
  }
}

it('blockers name each kind of held work, loops, apps, and holds', () => {
  assert.deepEqual(
    park_blockers(idle, { loops_running: 0, apps_running: 0 }),
    []
  )
  assert.deepEqual(
    park_blockers(
      { actors: 1, kinds: { turn: 2 } },
      { loops_running: 1, apps_running: 3, held: true }
    ),
    ['operator hold', '2 turn', '1 loop', '3 app']
  )
})

it('an idle halo parks after one idle minute: stopping, parked, then power off', async () => {
  const { parker, seen, wait } = host()
  assert.equal((await parker.check()).state, 'idle')
  wait(PARK_AFTER_MS - 1)
  assert.equal((await parker.check()).state, 'idle')
  wait(1)
  assert.equal((await parker.check()).state, 'parked')
  assert.deepEqual(seen.intents, ['stopping', 'parked'])
  assert.equal(seen.poweroffs, 1)
})

it('activity resets the idle clock', async () => {
  let busy = true
  const { parker, seen, wait } = host({
    activity: () => (busy ? { actors: 1, kinds: { connection: 1 } } : idle)
  })
  assert.deepEqual(await parker.check(), {
    state: 'busy',
    blockers: ['1 connection']
  })
  busy = false
  await parker.check()
  wait(PARK_AFTER_MS / 2)
  busy = true
  await parker.check()
  busy = false
  await parker.check()
  wait(PARK_AFTER_MS / 2)
  assert.equal((await parker.check()).state, 'idle')
  assert.equal(seen.poweroffs, 0)
})

it('running apps and an operator hold keep the halo up', async () => {
  for (const options of [{ apps: 1 }, { held: true }]) {
    const { parker, seen, wait } = host(options)
    await parker.check()
    wait(PARK_AFTER_MS * 5)
    assert.equal((await parker.check()).state, 'busy')
    assert.equal(seen.poweroffs, 0)
  }
})

it('a failed sync blocks parking, reopens, and records running', async () => {
  const { parker, seen, wait } = host({
    park: async () => ({ ok: false, reason: 'a-1 did not sync' })
  })
  await parker.check()
  wait(PARK_AFTER_MS)
  assert.deepEqual(await parker.check(), {
    state: 'blocked',
    reason: 'a-1 did not sync'
  })
  assert.deepEqual(seen.intents, ['stopping', 'running'])
  assert.deepEqual([seen.reopened, seen.poweroffs], [1, 0])
})

it('work that arrives during the pass cancels the power off', async () => {
  let late = false
  const { parker, seen, wait } = host({
    activity: () => (late ? { actors: 1, kinds: { turn: 1 } } : idle),
    park: async () => {
      late = true
      return { ok: true }
    }
  })
  await parker.check()
  wait(PARK_AFTER_MS)
  assert.equal((await parker.check()).state, 'blocked')
  assert.deepEqual(seen.intents, ['stopping', 'running'])
  assert.equal(seen.poweroffs, 0)
})

it('a failed parked record never powers off', async () => {
  const { parker, seen, wait } = host()
  parker.mirror = {
    put: async (key, body) => {
      const { intent } = read_lifecycle(body)
      if (intent === 'parked') throw new Error('sync down')
      seen.intents.push(intent)
    }
  }
  await parker.check()
  wait(PARK_AFTER_MS)
  assert.equal((await parker.check()).state, 'blocked')
  assert.equal(seen.poweroffs, 0)
  assert.equal(seen.reopened, 1)
})

/** A store with no volume: park needs lock, live_actors, busy, and two hooks. */
const store_with = (records, { synced = () => true } = {}) => {
  const store = Object.create(ActorStore.prototype)
  store.lock = { run: work => work() }
  store.busy = new Map()
  store.closed = false
  store.touch = async () => {}
  store.list = () => records
  store.stopped = []
  return { store, synced }
}

it('the store refuses new starts while closed for parking', async () => {
  const { store } = store_with([])
  store.closed = true
  assert.throws(() => store.ensure_running('a-1'), Parking)
  store.reopen()
  assert.equal(store.closed, false)
})

it('a busy actor stops the store pass and reopens it', async () => {
  const { store } = store_with([{ id: 'a-1', state: 'running' }])
  store.begin_work('a-1', 'turn:1')
  assert.deepEqual(await store.park(), { ok: false, reason: 'a-1 is busy' })
  assert.equal(store.closed, false)
})
