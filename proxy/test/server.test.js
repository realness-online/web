import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { agent_service } from "../src/server.js"
import { issue_model_pass } from "../src/model-pass.js"

const secret = "model-pass-server-test-secret-at-least-thirty-two-bytes"
let server, url, calls
before(async () => {
  calls = []
  server = agent_service({
    identify_phone: async (token) => token === "phone.token.signature" ? { phone: "+14155550123" } : null,
    secret,
    key: "test-key",
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
})
