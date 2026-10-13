import assert from "node:assert/strict"
import { test } from "node:test"
import { ActorStore } from "../../../src/host/actors.js"

function store({ created = "", existing = [] } = {}) {
  const traced = []
  const instance = Object.create(ActorStore.prototype)
  Object.assign(instance, {
    turned: new Set(),
    traceOf: () => existing,
    trace: (id, event, fields) => traced.push({ id, event, ...fields }),
    get: () => ({ created }),
  })
  instance.traced = traced
  return instance
}

const at = Date.parse("2026-10-05T00:00:00Z")

test("the first turn is measured from the actor's create", () => {
  const instant = store({ created: new Date(at - 4000).toISOString() })
  assert.equal(instant.firstTurn("a1", at), 4000)
  assert.deepEqual(instant.traced, [{ id: "a1", event: "first-turn", ms: 4000 }])
})

test("only the first turn is recorded, in memory and across a restart", () => {
  const instant = store({ created: new Date(at - 10).toISOString() })
  assert.equal(instant.firstTurn("a1", at), 10)
  assert.equal(instant.firstTurn("a1", at + 5000), null)
  instant.firstTurn("a2", at)
  assert.deepEqual(instant.traced.map((row) => row.id), ["a1", "a2"])

  const restarted = store({ existing: [{ event: "first-turn", ms: 12 }] })
  assert.equal(restarted.firstTurn("a1", at), null)
  assert.deepEqual(restarted.traced, [])
})

test("a create with no readable time still records the turn, without a number", () => {
  const instant = store({ created: "" })
  assert.equal(instant.firstTurn("a1", at), null)
  assert.deepEqual(instant.traced, [{ id: "a1", event: "first-turn" }])
})