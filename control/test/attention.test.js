import assert from "node:assert/strict"
import { test } from "node:test"
import { attention } from "../src/attention.js"
import { gather, overview_text } from "../src/overview.js"

const limits = { stale_s: 120, free_pct: 15, spend_day: 5, quiet_running_h: 2, deep_loop: 2, loop_deadline_min: 60 }
const now = Date.parse("2026-09-30T12:00:00Z")
const ago = (minutes) => new Date(now - minutes * 60e3).toISOString()
const host = (over = {}, actors = []) => ({ host: { name: "h1", seed: "ready", volume_free: 50, volume_size: 100, mem_free: 50, mem_total: 100, ...over }, age_s: 10, actors })
const clean = {
  hosts: [host({}, [{ id: "a-1", state: "running", last_activity: ago(5) }, { id: "a-2", state: "idle", last_activity: ago(600) }])],
  loops: [{ id: "a-3", status: "running", started: ago(10), depth: 1 }, { id: "a-4", status: "stopped", started: ago(600), depth: 1 }],
  services: [{ name: "brayness-sync", found: true, ready: true }],
  errors: [{ service: "brayness-sync", count: 0, last: "" }],
  spend: { cost: 4.99 },
}
const kinds = (view) => attention(view, limits, now).map((line) => line.kind).sort()

test("a clean picture needs no attention", () => {
  assert.deepEqual(attention(clean, limits, now), [])
  assert.match(overview_text(clean, []), /attention: none/)
})

test("each rule flags its own case", () => {
  const cases = [
    [{ hosts: [{ ...host(), age_s: 121 }] }, "stale"],
    [{ hosts: [host({ seed: "stale" })] }, "seed"],
    [{ hosts: [host({ volume_free: 14 })] }, "disk"],
    [{ hosts: [host({ mem_free: 10 })] }, "memory"],
    [{ hosts: [host({}, [{ id: "a-1", state: "running", last_activity: ago(121) }])] }, "long"],
    [{ hosts: [host({}, [{ id: "a-1", state: "incomplete", last_activity: "" }])] }, "incomplete"],
    [{ loops: [{ id: "a-3", status: "stopped", started: ago(5), error: "probe exit 1" }] }, "loop"],
    [{ loops: [{ id: "a-3", status: "running", started: ago(61), depth: 1 }] }, "long"],
    [{ loops: [{ id: "a-3", status: "running", started: ago(5), depth: 2 }] }, "deep"],
    [{ services: [{ name: "brayness-proxy", found: false }] }, "service"],
    [{ services: [{ name: "brayness-proxy", found: true, ready: false }] }, "service"],
    [{ errors: [{ service: "brayness-sync", count: 3, last: "boom" }] }, "errors"],
    [{ spend: { cost: 5.01 } }, "spend"],
    [{ unread: [{ source: "errors", error: "gcloud: auth" }] }, "unread"],
  ]
  for (const [view, kind] of cases) assert.deepEqual(kinds({ ...clean, ...view }), [kind], kind)
})

test("gather keeps going when one source fails, and names it", async () => {
  const sources = { spend: async () => { throw new Error("sync 503") }, services: async () => [] }
  const view = await gather({ now }, ["spend", "services"], sources)
  assert.deepEqual(view.services, [])
  assert.deepEqual(kinds({ ...clean, unread: view.unread }), ["unread"])
  assert.deepEqual(view.unread, [{ source: "spend", error: "sync 503" }])
})
