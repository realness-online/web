import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { disk } from "#root/src/can/disk.js"
import { dev_issuer } from "../../../src/sync/dev-token.js"
import { rights } from "../../../src/sync/rights.js"
import { sync_service } from "../../../src/sync/server.js"
import { FIRST_REPEAT_MS } from "../../../src/sync/host-alerts.js"
import { out_path } from "#root/lib/output.js"

const dir = out_path(`host-alert-run-test-${randomUUID()}`)
const token = "alert-clock-secret-at-least-thirty-two-bytes"
const issuer = dev_issuer()
const storage = disk(dir)
const messages = []
let server
let url

const quiet = `<article itemscope itemtype="/host"><meta itemprop="checked" content="2026-10-05T11:00:00.000Z"></article>`

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put("hosts/brayness-1/status.html", quiet)
  server = sync_service({
    storage,
    rights: rights(storage),
    project: issuer.project,
    certs: issuer.certs,
    alert_token: token,
    alert_webhook: "https://hooks.slack.com/services/x",
    log: () => {},
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const run = (authorization) => fetch(`${url}/v1/host-watch/run`, { method: "POST", headers: authorization ? { authorization } : {} })

test("only the scheduler's secret wakes the alert run", async () => {
  assert.equal((await run()).status, 401)
  assert.equal((await run("Bearer wrong")).status, 401)
  assert.equal((await run(`Bearer ${token}x`)).status, 401)
  assert.equal((await run(`Bearer ${issuer.token("+15555550100")}`)).status, 401)
})

test("the run posts a webhook and stores backoff state, then stays quiet", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (target, options) => {
    if (String(target).startsWith(url)) return original(target, options)
    messages.push({ target, body: JSON.parse(options.body) })
    return { ok: true, status: 200 }
  }
  try {
    const first = await (await run(`Bearer ${token}`)).json()
    assert.deepEqual(first.sent, [{ kind: "down", name: "brayness-1" }])
    assert.equal(messages[0].target, "https://hooks.slack.com/services/x")
    assert.match(messages[0].body.text, /brayness-1 stopped reporting/)

    const stored = JSON.parse((await storage.get("alerts/host-watch.json")).body.toString("utf8"))
    assert.ok(stored["brayness-1"].sent > 0, "state remembers when it was sent")

    const again = await (await run(`Bearer ${token}`)).json()
    assert.deepEqual(again.sent, [])
    assert.equal(messages.length, 1)

    stored["brayness-1"].sent = Date.now() - FIRST_REPEAT_MS
    await storage.put("alerts/host-watch.json", `${JSON.stringify(stored)}\n`)
    const repeat = await (await run(`Bearer ${token}`)).json()
    assert.deepEqual(repeat.sent, [{ kind: "repeat", name: "brayness-1" }])
    assert.equal(messages.length, 2)
  } finally {
    globalThis.fetch = original
  }
})