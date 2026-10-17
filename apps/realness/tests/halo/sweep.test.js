import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ActorStore } from '../../src/halo/actors.js'
import { MEMORY_AFTER, EXPORT_AFTER } from '../../src/halo/lifecycle.js'

const now = 10 * EXPORT_AFTER
const record = (id, state, age, owner = '+14155550123') => ({
  id,
  state,
  owner,
  created: new Date(now - age).toISOString(),
  last_activity: new Date(now - age).toISOString()
})

/** A store with no volume: sweep only needs list(), lock, and busy. */
function fake(records) {
  const store = Object.create(ActorStore.prototype)
  store.lock = { run: work => work() }
  store.busy = new Map()
  store.touch = async () => {}
  store.list = () => records
  return store
}

test('sweep steps each stale actor once and leaves busy ones alone', async () => {
  const records = [
    record('a-run', 'running', MEMORY_AFTER),
    record('a-idle', 'idle', MEMORY_AFTER * 9),
    record('a-old', 'stopped', EXPORT_AFTER),
    record('a-fresh', 'running', 1000),
    record('a-ownerless', 'stopped', EXPORT_AFTER, null)
  ]
  const store = fake(records)
  store.beginWork('a-run', 'turn:1')
  const applied = []
  const done = await store.sweep({
    now,
    apply: (r, step) => applied.push([r.id, step])
  })
  assert.deepEqual(applied, [
    ['a-idle', 'disk'],
    ['a-old', 'export']
  ])
  assert.deepEqual(done, [
    { id: 'a-idle', step: 'disk' },
    { id: 'a-old', step: 'export' }
  ])
})

test('sweep is a no-op when nothing is stale', async () => {
  const store = fake([record('a-fresh', 'running', 1000)])
  assert.deepEqual(
    await store.sweep({
      now,
      apply: () => {
        throw new Error('should not apply')
      }
    }),
    []
  )
})

test('k1: with sync, sweep retires a synced idle actor instead of dropping it to disk', async () => {
  const synced = {
    ...record('a-synced', 'idle', MEMORY_AFTER * 9),
    synced_at: new Date(now).toISOString()
  }
  const store = fake([synced, record('a-unsynced', 'idle', MEMORY_AFTER * 9)])
  store.syncUrl = 'https://sync.test'
  const applied = []
  await store.sweep({ now, apply: (r, step) => applied.push([r.id, step]) })
  assert.deepEqual(applied, [
    ['a-synced', 'retire'],
    ['a-unsynced', 'disk']
  ])
})

test('work is held per key: a second release, or another key, does not free the actor', () => {
  const store = fake([])
  store.beginWork('a-1', 'turn:1')
  store.beginWork('a-1', 'connection:1')
  store.beginWork('a-1', 'loop')
  store.beginWork('a-1', 'loop')
  assert.deepEqual(store.activity(), {
    actors: 1,
    kinds: { turn: 1, connection: 1, loop: 1 }
  })
  store.endWork('a-1', 'turn:1')
  store.endWork('a-1', 'turn:1')
  assert.equal(store.isBusy('a-1'), true)
  store.endWork('a-1', 'connection:1')
  store.endWork('a-1', 'loop')
  assert.equal(store.isBusy('a-1'), false)
  assert.deepEqual(store.activity(), { actors: 0, kinds: {} })
})
