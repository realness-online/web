import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { disk } from "#root/src/can/disk.js"
import { dev_issuer } from "#root/src/sync/dev-token.js"
import { rights } from "#root/src/sync/rights.js"
import { sync_service } from "#root/src/sync/server.js"
import { usage_row } from "#root/src/proxy/usage.js"
import { plan_html } from "#root/src/proxy/billing.js"
import { reader, actors, loops, usage, person, limit, text } from "../../../src/control/reads.js"
import { redact } from "../../../src/control/output.js"
import { out_path } from "#root/lib/output.js"

const dir = out_path(`control-reads-test-${randomUUID()}`)
const issuer = dev_issuer()
const storage = disk(dir)
const admin = "+15555550100"
const owner = "+15555550101"
const loop_id = "a-0123456789ab"
const now = Date.parse("2026-09-30T12:01:00Z")
let server, url

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put("admins.html", `<a href="tel:${admin}">Admin</a>`)
  await storage.put("hosts/brayness-1/status.html", `<article itemscope itemtype="/host"><meta itemprop="name" content="brayness-1"><meta itemprop="checked" content="2026-09-30T12:00:00.000Z"></article>\n<article itemscope itemtype="/actor"><meta itemprop="id" content="${loop_id}"><meta itemprop="owner" content="${owner}"><meta itemprop="state" content="idle"></article>\n<article itemscope itemtype="/actor"><meta itemprop="id" content="a-ffffffffffff"><meta itemprop="owner" content="${admin}"><meta itemprop="state" content="running"></article>\n`)
  await storage.put(`loops/${loop_id}/record.html`, `<article itemscope itemtype="/loop"><meta itemprop="id" content="${loop_id}"><meta itemprop="owner" content="${owner}"><meta itemprop="status" content="running"><meta itemprop="runs" content="3"><meta itemprop="tokens" content="900"><meta itemprop="started" content="2026-09-30T11:00:00Z"><p itemprop="goal">tune &lt;poster&gt; &amp; trace</p></article>\n`)
  for (const [time, cost] of [["120000000", 0.01], ["120100000", 0.02]]) {
    await storage.put(`usage/${owner}/2026-09-30/${time}-${loop_id}-abc123.html`, usage_row({ model: "deepseek", actor: loop_id, status: 200, request_bytes: 10, reply_bytes: 20, usage: { prompt_tokens: 100, completion_tokens: 50, cost } }))
  }
  server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const as = (phone) => reader("local", { url, token: async () => issuer.token(phone) })

test("actor list and show come from the host's last report", async () => {
  const sync = await as(admin)
  assert.equal((await actors(sync, null, now)).length, 2)
  const [actor] = await actors(sync, loop_id, now)
  assert.equal(actor.host, "brayness-1")
  assert.equal(actor.age_s, 60)
  await assert.rejects(actors(sync, "a-000000000000", now), /no actor/)
})

test("loop records parse, unescape, and type their counts", async () => {
  const [loop] = await loops(await as(admin))
  assert.equal(loop.goal, "tune <poster> & trace")
  assert.equal(loop.runs, 3)
  await assert.rejects(loops(await as(admin), "../x"), /invalid loop id/)
})

test("usage totals one day; an empty day is zero, not an error", async () => {
  const sync = await as(admin)
  const day = await usage(sync, owner, "2026-09-30")
  assert.deepEqual([day.calls, day.tokens], [2, 300])
  assert.ok(Math.abs(day.cost - 0.03) < 1e-9)
  assert.equal((await usage(sync, owner, "2026-01-01")).calls, 0)
  await assert.rejects(usage(sync, owner, "yesterday"), /YYYY-MM-DD/)
})

test("person gathers only that phone, and output masks it", async () => {
  const found = await person(await as(admin), owner, { day: "2026-09-30", now })
  assert.deepEqual(found.actors.map((a) => a.id), [loop_id])
  assert.equal(found.loops.length, 1)
  assert.equal(found.usage.tokens, 300)
  assert.equal(JSON.stringify(redact(found)).includes(owner), false)
  assert.match(text.person(found), /actors: 1/)
})

test("non-admins cannot read other people's records", async () => {
  const sync = await as(owner)
  await assert.rejects(actors(sync), /403/)
  await assert.rejects(loops(sync), /403/)
  await assert.rejects(usage(await as("+15555550102"), owner, "2026-09-30"), /403/)
})

test("actor idle writes a request only the host can read; loop stop writes stop.html", async () => {
  const { request_actor, request_loop_stop } = await import("../../../src/control/reads.js")
  const { read_request } = await import("#root/src/sync/actor-request.js")
  const sync = await as(admin)
  const done = await request_actor(sync, "a-ffffffffffff", "idle", now)
  assert.equal(done.host, "brayness-1")
  const stored = read_request((await storage.get("hosts/brayness-1/requests/a-ffffffffffff.html")).body.toString())
  assert.equal(stored.action, "idle")
  assert.equal(stored.id, done.request)
  assert.equal((await request_actor(sync, loop_id, "idle", now)).already, "idle")
  await assert.rejects(request_actor(sync, loop_id, "destroy", now), /idle\|stop/)
  await assert.rejects(request_actor(await as(owner), loop_id, "stop", now), /403/)
  await request_loop_stop(sync, loop_id)
  assert.ok(await storage.get(`loops/${loop_id}/stop.html`))
})

test("b1e: limit sums today and the month against free limits", async () => {
  await storage.put(`usage/${owner}/2026-09-02/000000000Z-phone-def456.html`, usage_row({ model: "m", actor: "phone", status: 200, request_bytes: 1, reply_bytes: 1, usage: { prompt_tokens: 1000, completion_tokens: 0, cost: 0 } }))
  await storage.put(`usage/${owner}/2026-08-31/000000000Z-phone-def456.html`, usage_row({ model: "m", actor: "phone", status: 200, request_bytes: 1, reply_bytes: 1, usage: { prompt_tokens: 9999, completion_tokens: 0, cost: 0 } }))
  const sync = await as(admin)
  const found = await limit(sync, owner, new Date(now))
  assert.equal(found.plan, "free")
  assert.equal(found.free.day.used, 300)
  assert.equal(found.free.month.used, 1300)
  assert.equal(found.free.day.left, 249_700)
  assert.equal(found.free.month.limit, 3_000_000)
  assert.equal(found.paid, null)
  assert.match(text.limit(found), /today: 300 of 250,000 free tokens \(0%\), 249,700 left/)
  const fresh = await limit(sync, "+15555550109", new Date(now))
  assert.equal(fresh.free.month.used, 0)
  await assert.rejects(limit(sync, "nope"), /limit <phone>/)
})

test("b1e: a paid plan shows its credit from the period start", async () => {
  await storage.put(`billing/${owner}/plan.html`, plan_html({ status: "active", credit: 5, start: "2026-08-31", end: "2026-09-30T23:00:00.000Z", subscription: "sub_1" }))
  const found = await limit(await as(admin), owner, new Date(now))
  assert.equal(found.plan, "paid")
  assert.equal(found.paid.used.toFixed(2), "0.03")
  assert.match(text.limit(found), /credit: \$0\.03 of \$5\.00 \(0%\), renews 2026-09-30/)
  await storage.delete?.(`billing/${owner}/plan.html`)
})
