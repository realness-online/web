import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { existsSync } from "node:fs"
import { QUOTA_MESSAGE, agent_service } from "../src/server.js"
import { issue_model_pass } from "../src/model-pass.js"

const secret = "model-pass-server-test-secret-at-least-thirty-two-bytes"
let server, url, calls, rows
const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
before(async () => {
  calls = []
  rows = []
  server = agent_service({
    identify_phone: async (token) => token === "phone.token.signature" ? { phone: "+14155550123" } : null,
    secret,
    key: "test-key",
    ledger: { record: async (phone, row) => rows.push({ phone, ...row }) },
    fetcher: async (_url, options) => {
      calls.push(options)
      return new Response("data: done\n", { headers: { "content-type": "text/event-stream" } })
    },
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  url = `http://127.0.0.1:${server.address().port}`
})
after(() => new Promise((resolve) => server.close(resolve)))

test("a stranger cannot spend upstream calls", async () => {
  const result = await fetch(url, { method: "POST", headers: { authorization: "Bearer shared-pass" }, body: "{}" })
  assert.equal(result.status, 401)
  assert.equal(calls.length, 0)
})

test("an identified person receives the streamed reply", async () => {
  const result = await fetch(url, { method: "POST", headers: { authorization: "Bearer phone.token.signature" }, body: JSON.stringify({ messages: [] }) })
  assert.equal(result.status, 200)
  assert.equal(result.headers.get("content-type"), "text/event-stream")
  assert.equal(await result.text(), "data: done\n")
  assert.equal(calls.length, 1)
  assert.deepEqual(JSON.parse(calls[0].body).usage, { include: true })
  await settle()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].phone, "+14155550123")
  assert.equal(rows[0].actor, "phone")
  assert.equal(rows[0].reply_bytes, 11)
  assert.equal(rows[0].request_bytes, 15)
})

test("actor pass works; forged passes do not", async () => {
  const actor = { phone: "+14155550123", id: "a-abcdef123456" }
  const pass = issue_model_pass(actor, secret)
  const result = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${pass}` }, body: "{}" })
  assert.equal(result.status, 200)
  assert.equal(calls.length, 2)
  const [body, signature] = pass.split(".")
  const rejected = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${body}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}` }, body: "{}" })
  assert.equal(rejected.status, 401)
  assert.equal(calls.length, 2)
  await settle()
  assert.equal(rows.length, 2)
  assert.equal(rows[1].actor, "a-abcdef123456")
})

test("quota: over is 429, unreadable is 503, neither calls upstream", async () => {
  const start = async (spent) => {
    const quota_server = agent_service({
      identify_phone: async () => ({ phone: "+14155550123" }),
      secret,
      key: "test-key",
      quota: { tokens: 100 },
      warn: () => {},
      ledger: { spent, record: async () => {} },
      fetcher: async (_url, options) => (calls.push(options), new Response("ok")),
    })
    await new Promise((resolve) => quota_server.listen(0, "127.0.0.1", resolve))
    const reply = await fetch(`http://127.0.0.1:${quota_server.address().port}`, { method: "POST", headers: { authorization: "Bearer phone.token.signature" }, body: "{}" })
    await new Promise((resolve) => quota_server.close(resolve))
    return reply.status
  }
  const before = calls.length
  assert.equal(await start(async () => ({ tokens: 100, cost: 0 })), 429)
  assert.equal(await start(async () => { throw new Error("down") }), 503)
  assert.equal(calls.length, before)
  assert.equal(await start(async () => ({ tokens: 99, cost: 0 })), 200)
})

// Pi retries a 429 unless its text says the quota is spent.
const pi_retry = new URL("../../../../.pi/agent/npm/node_modules/@earendil-works/pi-ai/dist/utils/retry.js", import.meta.url)
test("Pi does not retry the quota refusal", { skip: !existsSync(pi_retry) && "no local pi-ai" }, async () => {
  const { isRetryableAssistantError } = await import(pi_retry)
  assert.equal(isRetryableAssistantError({ stopReason: "error", errorMessage: `429 ${QUOTA_MESSAGE}` }), false)
  assert.equal(isRetryableAssistantError({ stopReason: "error", errorMessage: "429 Too many requests" }), true)
})
