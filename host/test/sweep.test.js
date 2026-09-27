import assert from "node:assert/strict"
import { test } from "node:test"
import { ActorStore } from "../src/actors.js"
import { MEMORY_AFTER, EXPORT_AFTER } from "../src/lifecycle.js"

const now = 10 * EXPORT_AFTER
const record = (id, state, age, owner = "+14155550123") => ({
  id, state, owner, created: new Date(now - age).toISOString(), last_activity: new Date(now - age).toISOString(),
})

/** A store with no volume: sweep only needs list(), lock, and busy. */
function fake(records) {
  const store = Object.create(ActorStore.prototype)
  store.lock = { run: (work) => work() }
  store.busy = new Set()
  store.list = () => records
  return store
}

test("sweep steps each stale actor once and leaves busy ones alone", async () => {
  const records = [
    record("a-run", "running", MEMORY_AFTER),
    record("a-idle", "idle", MEMORY_AFTER * 9),
    record("a-old", "stopped", EXPORT_AFTER),
    record("a-fresh", "running", 1000),
    record("a-ownerless", "stopped", EXPORT_AFTER, null),
  ]
  const store = fake(records)
  store.busy.add("a-run")
  const applied = []
  const done = await store.sweep({ now, apply: (r, step) => applied.push([r.id, step]) })
  assert.deepEqual(applied, [["a-idle", "disk"], ["a-old", "export"]])
  assert.deepEqual(done, [{ id: "a-idle", step: "disk" }, { id: "a-old", step: "export" }])
})

test("sweep is a no-op when nothing is stale", async () => {
  const store = fake([record("a-fresh", "running", 1000)])
  assert.deepEqual(await store.sweep({ now, apply: () => { throw new Error("should not apply") } }), [])
})
