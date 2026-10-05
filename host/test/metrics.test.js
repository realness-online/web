import assert from "node:assert/strict"
import { test } from "node:test"
import { metrics_from, metric_fields, percentile, summarize } from "../src/metrics.js"

test("nearest-rank percentiles are real samples, not interpolations", () => {
  assert.equal(percentile([], 0.5), null)
  assert.equal(percentile([7], 0.5), 7)
  assert.equal(percentile([7], 0.99), 7)
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2)
  assert.equal(percentile([1, 2, 3, 4], 0.99), 4)
  assert.equal(percentile([1, 2, 3, 100], 0.5), 2)
  assert.equal(percentile([1, 2, 3, 100], 0.99), 100)
})

test("summarize ignores non-numbers and reports the count", () => {
  assert.equal(summarize([undefined, null, "12"]), null)
  assert.deepEqual(summarize([10, 20, 30]), { count: 3, p50: 20, p99: 30 })
})

const read = (rows) => () => rows

test("create and reload phases are summarized separately", () => {
  const events = [
    { event: "create", vm_ms: 100, agent_ms: 10, init_ms: 20, ms: 130 },
    { event: "create", vm_ms: 200, agent_ms: 20, init_ms: 30, ms: 250 },
    { event: "reload", from_memory: true, vm_ms: 50, agent_ms: 5, init_ms: 10, ms: 65 },
    { event: "exec", ms: 4 },
  ]
  const metrics = metrics_from(["a1"], read(events))
  assert.deepEqual(metrics.create.ms, { count: 2, p50: 130, p99: 250 })
  assert.deepEqual(metrics.create.vm_ms, { count: 2, p50: 100, p99: 200 })
  assert.deepEqual(metrics.reload.ms, { count: 1, p50: 65, p99: 65 })
  assert.equal(metrics.create.agent_ms.p50, 10)
})

test("an event with no timing is left out rather than reported as zero", () => {
  const metrics = metrics_from(["a1"], read([{ event: "create", hostname: "h" }, { event: "reload", ms: 65 }]))
  assert.equal(metrics.create, undefined)
  assert.deepEqual(metrics.reload.ms, { count: 1, p50: 65, p99: 65 })
})

test("no traces means no metrics, not an empty summary", () => {
  assert.deepEqual(metrics_from(["a1"], read([])), {})
})

test("metric fields flatten for the HTML Lines record", () => {
  const fields = metric_fields({ create: { ms: { count: 2, p50: 130, p99: 250 } }, probe: { count: 2, p50: 11, p99: 12 } })
  assert.deepEqual(fields, { create_ms_count: 2, create_ms_p50: 130, create_ms_p99: 250, probe_count: 2, probe_p50: 11, probe_p99: 12 })
})

test("the first turn is summarized on its own, apart from create", () => {
  const events = [
    { event: "create", vm_ms: 100, agent_ms: 10, ms: 130 },
    { event: "first-turn", ms: 4000 },
    { event: "first-turn", ms: 9000 },
  ]
  const metrics = metrics_from(["a1"], read(events))
  assert.deepEqual(metrics.turn, { count: 2, p50: 4000, p99: 9000 })
  assert.deepEqual(metrics.create.vm_ms, { count: 1, p50: 100, p99: 100 })
  assert.deepEqual(metric_fields(metrics).turn_p50, 4000)
})