import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { disk } from "brayness-can-store/disk"
import { dev_issuer } from "../src/dev-token.js"
import { rights } from "../src/rights.js"
import { sync_service } from "../src/server.js"
import { QUIET_AFTER_MS, host_health, quiet_hosts } from "../src/host-watch.js"

const dir = new URL(`../../dist/host-watch-test-${randomUUID()}`, import.meta.url).pathname
const issuer = dev_issuer()
const storage = disk(dir)
const admin = "+15555550100"
const other = "+15555550101"
let server
let url

const record = (name, checked) =>
  storage.put(`hosts/${name}/status.html`, `<article itemscope itemtype="/host"><meta itemprop="name" content="${name}"><meta itemprop="checked" content="${checked}"></article>\n`)

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put("admins.html", `<a href="tel:${admin}">Admin</a>`)
  await record("brayness-1", "2026-10-05T12:00:00.000Z") // old
  await record("brayness-2", "2026-10-05T11:59:30.000Z") // fresh
  server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const as = (phone) => ({ authorization: `Bearer ${issuer.token(phone)}` })
const at = Date.parse("2026-10-05T12:01:00Z")

test("a host quiet past the threshold is named, with its age", async () => {
  // brayness-1 is 150s old here, brayness-2 is 180s.
  const quiet = await quiet_hosts(storage, { now: Date.parse("2026-10-05T12:02:30Z") })
  assert.deepEqual(quiet, [
    { name: "brayness-2", checked: "2026-10-05T11:59:30.000Z", age_s: 180 },
    { name: "brayness-1", checked: "2026-10-05T12:00:00.000Z", age_s: 150 },
  ])
})

test("a host inside the threshold is not quiet, and the boundary is exclusive", async () => {
  const fresh = await quiet_hosts(storage, { now: Date.parse("2026-10-05T12:01:00Z") })
  assert.deepEqual(fresh, [])
  const just = await quiet_hosts(storage, { now: Date.parse("2026-10-05T12:02:00Z") })
  assert.deepEqual(just.map((h) => h.name), ["brayness-2"]) // exactly 120s is still alive
  const past = await quiet_hosts(storage, { now: Date.parse("2026-10-05T12:02:01Z") })
  assert.deepEqual(past.map((h) => h.name), ["brayness-2", "brayness-1"])
})

test("the threshold is the report interval with room to miss three", () => {
  assert.equal(QUIET_AFTER_MS, 120_000)
})

test("a record with no readable time is quiet, not alive", async () => {
  await record("brayness-3", "")
  const quiet = await quiet_hosts(storage, { now: at })
  assert.deepEqual(quiet.map((h) => h.name), ["brayness-3"])
  assert.equal(quiet[0].age_s, null)
})

test("a host directory with no record is quiet", async () => {
  await storage.put("hosts/brayness-4/notes.txt", "half-made")
  const quiet = await quiet_hosts(storage, { now: at })
  assert.ok(quiet.some((h) => h.name === "brayness-4" && h.age_s === null))
})

test("the derived answer carries its own reading time and threshold", async () => {
  const health = await host_health(storage, { now: at })
  assert.equal(health.checked, "2026-10-05T12:01:00.000Z")
  assert.equal(health.quiet_ms, QUIET_AFTER_MS)
  assert.ok(health.quiet.some((h) => h.name === "brayness-3"))
})

test("only an admin reads host health, and it is never stored", async () => {
  const get = (headers) => fetch(`${url}/hosts/quiet.json`, { headers })
  assert.equal((await get()).status, 401)
  assert.equal((await get(as(other))).status, 403)
  const body = await (await get(as(admin))).json()
  assert.ok(body.quiet.some((h) => h.name === "brayness-3"))
  assert.equal(await storage.get("hosts/quiet.json"), null)
})