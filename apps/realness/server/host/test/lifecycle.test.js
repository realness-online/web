import assert from "node:assert/strict"
import { test } from "node:test"
import { next_step, MEMORY_AFTER, DISK_AFTER, EXPORT_AFTER, RETIRE_AFTER } from "../../../src/host/lifecycle.js"

const now = 10 * EXPORT_AFTER
const owned = (state, age, owner = "+14155550123") => ({
  id: "a-one", state, owner, created: new Date(now - age).toISOString(), last_activity: new Date(now - age).toISOString(),
})

test("a running actor steps to memory, then disk, then export", () => {
  assert.equal(next_step(owned("running", MEMORY_AFTER - 1), now), null)
  assert.equal(next_step(owned("running", MEMORY_AFTER), now), "memory")
  assert.equal(next_step(owned("idle", DISK_AFTER), now), "disk")
  assert.equal(next_step(owned("stopped", EXPORT_AFTER), now), "export")
  assert.equal(next_step(owned("stopped", EXPORT_AFTER - 1), now), null)
})

test("an actor without a verified owner is never retired", () => {
  assert.equal(next_step(owned("stopped", EXPORT_AFTER, null), now), null)
  assert.equal(next_step(owned("running", MEMORY_AFTER, ""), now), null)
})

test("recent activity holds an actor back", () => {
  const record = owned("running", MEMORY_AFTER * 4)
  record.last_activity = new Date(now - 1000).toISOString()
  assert.equal(next_step(record, now), null)
})

test("k1: with sync, an actor retires at two hours once a final sync followed its last activity", () => {
  const synced = (state, age, synced_after) => ({ ...owned(state, age), synced_at: new Date(now - age + synced_after).toISOString() })
  assert.equal(next_step(synced("idle", RETIRE_AFTER, 1000), now, { synced: true }), "retire")
  assert.equal(next_step(synced("stopped", RETIRE_AFTER, 0), now, { synced: true }), "retire")
  assert.equal(next_step(synced("idle", RETIRE_AFTER - 1, 1000), now, { synced: true }), null)
  assert.equal(next_step(synced("idle", RETIRE_AFTER, -1000), now, { synced: true }), "disk")
  assert.equal(next_step(owned("idle", RETIRE_AFTER), now, { synced: true }), "disk")
  assert.equal(next_step(synced("idle", RETIRE_AFTER, 1000), now), "disk")
  assert.equal(next_step(synced("running", RETIRE_AFTER, 1000), now, { synced: true }), "memory")
})
