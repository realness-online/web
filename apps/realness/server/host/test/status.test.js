import assert from "node:assert/strict"
import { test } from "node:test"
import { HostStatus, read_status, status_html } from "../../../src/host/status.js"

const A = "+14155550123"

const fake_store = (volume = "/") => ({
  volume,
  seedStatus: () => ({ built: true, matches: true }),
  list: () => [
    { id: "a-000000000001", owner: A, state: "running", created: "2026-09-30T10:00:00Z", last_activity: "2026-09-30T12:00:00Z" },
    { id: "a-000000000002", owner: A, state: "idle", created: "2026-09-30T09:00:00Z", last_activity: "2026-09-30T11:00:00Z" },
    { id: "a-000000000003", owner: null, state: "incomplete", created: "", last_activity: "" },
  ],
})
const fake_apps = { list: () => [{ id: "p-000000000001", owner: A, public: false }] }
const fake_loops = { all: () => [{ id: "a-000000000002", status: "running" }, { id: "a-000000000009", status: "stopped" }] }

test("a status record reads back as the host, its actors, and its apps", async () => {
  const now = new Date("2026-09-30T12:00:30Z")
  const status = new HostStatus(fake_store(), { apps: fake_apps, loops: fake_loops, host: "brayness-1", now: () => now })
  const read = read_status(status_html(await status.snapshot()))
  assert.equal(read.host.name, "brayness-1")
  assert.equal(read.host.checked, now.toISOString())
  assert.equal(read.host.seed, "ready")
  assert.equal(read.host.actors_running, "1")
  assert.equal(read.host.actors_idle, "1")
  assert.equal(read.host.loops_running, "1")
  assert.equal(read.host.apps, "1")
  assert.ok(Number(read.host.mem_total) > 0)
  assert.ok(Number(read.host.volume_size) > 0)
  assert.deepEqual(read.actors.map((actor) => [actor.id, actor.owner, actor.state]), [
    ["a-000000000001", A, "running"],
    ["a-000000000002", A, "idle"],
    ["a-000000000003", "", "incomplete"],
  ])
  assert.deepEqual(read.apps.map((app) => [app.id, app.owner, app.public]), [["p-000000000001", A, "false"]])
})

test("values are escaped, so a record cannot inject markup", () => {
  const html = status_html({ host: { name: `x"><script>` }, actors: [{ id: "a<b", owner: "&" }], apps: [] })
  assert.ok(!html.includes("<script>"))
  const read = read_status(html)
  assert.equal(read.host.name, `x"><script>`)
  assert.equal(read.actors[0].id, "a<b")
  assert.equal(read.actors[0].owner, "&")
})

test("publish writes hosts/<name>/status.html; no mirror writes nothing", async () => {
  const puts = []
  const mirror = { put: async (key, body) => puts.push([key, body]) }
  await new HostStatus(fake_store(), { mirror, host: "brayness-1" }).publish()
  assert.equal(puts.length, 1)
  assert.equal(puts[0][0], "hosts/brayness-1/status.html")
  assert.equal(read_status(puts[0][1]).host.name, "brayness-1")
  assert.equal(await new HostStatus(fake_store(), { host: "brayness-1" }).publish(), false)
})

test("a failed write is reported and never thrown", async () => {
  const mirror = { put: async () => { throw new Error("503 from storage") } }
  const warned = []
  const status = new HostStatus(fake_store(), { mirror, host: "brayness-1", warn: (message) => warned.push(message) })
  assert.equal(await status.publish(), false)
  assert.match(warned[0], /503 from storage/)
})

test("a volume that cannot be read reports zero, and the record still writes", async () => {
  const status = new HostStatus(fake_store("/no/such/volume"), { host: "h" })
  const read = read_status(status_html(await status.snapshot()))
  assert.equal(read.host.volume_size, "0")
  assert.equal(read.actors.length, 3)
})
