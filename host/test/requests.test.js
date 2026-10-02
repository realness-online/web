import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ActorRequests } from "../src/requests.js"
import { request_html } from "../../sync/src/actor-request.js"

const now = Date.parse("2026-09-30T12:00:00Z")
const ago = (ms) => new Date(now - ms).toISOString()

function setup(files, states) {
  const volume = mkdtempSync(join(tmpdir(), "requests-"))
  const idled = []
  const store = {
    volume,
    list: () => Object.entries(states).map(([id, state]) => ({ id, state })),
    idle: async (id, tier) => { idled.push([id, tier]); states[id] = tier === "memory" ? "idle" : "stopped" },
  }
  const mirror = { get: async (key) => (files[key] ? { body: Buffer.from(files[key]) } : null) }
  const make = () => new ActorRequests(store, { mirror, host: "h1", now: () => now })
  return { volume, idled, make, cleanup: () => rmSync(volume, { recursive: true, force: true }) }
}

const key = (id) => `hosts/h1/requests/${id}.html`

test("idle and stop are obeyed once, even across a host restart", async () => {
  const files = {
    [key("a-000000000001")]: request_html({ id: "r1", action: "idle", requested: ago(1000) }),
    [key("a-000000000002")]: request_html({ id: "r2", action: "stop", requested: ago(1000) }),
  }
  const t = setup(files, { "a-000000000001": "running", "a-000000000002": "idle", "a-000000000003": "running" })
  assert.deepEqual(await t.make().obey(), [{ id: "a-000000000001", action: "idle" }, { id: "a-000000000002", action: "stop" }])
  assert.deepEqual(t.idled, [["a-000000000001", "memory"], ["a-000000000002", "disk"]])
  // The person wakes the actor; the same request must not idle it again.
  const states_again = await t.make().obey()
  assert.deepEqual(states_again, [])
  t.cleanup()
})

test("stale, malformed, and other hosts' requests do nothing", async () => {
  const files = {
    [key("a-000000000001")]: request_html({ id: "r1", action: "idle", requested: ago(2 * 3600e3) }),
    [key("a-000000000002")]: `<article itemscope itemtype="/request"><meta itemprop="action" content="destroy"></article>`,
    ["hosts/h2/requests/a-000000000003.html"]: request_html({ id: "r3", action: "stop", requested: ago(0) }),
  }
  const t = setup(files, { "a-000000000001": "running", "a-000000000002": "running", "a-000000000003": "running" })
  assert.deepEqual(await t.make().obey(), [])
  assert.deepEqual(t.idled, [])
  t.cleanup()
})

test("one failing actor does not stop the pass", async () => {
  const files = { [key("a-000000000002")]: request_html({ id: "r2", action: "idle", requested: ago(0) }) }
  const t = setup(files, { "a-000000000001": "running", "a-000000000002": "running" })
  const r = t.make()
  const get = r.mirror.get
  r.mirror = { get: async (k) => { if (k.includes("000000000001")) throw new Error("503"); return get(k) } }
  assert.deepEqual(await r.obey(), [{ id: "a-000000000002", action: "idle" }])
  t.cleanup()
})
