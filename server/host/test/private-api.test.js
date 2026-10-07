import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { makeServer } from "../src/server.js"

const secret = "private-api-test-secret-at-least-thirty-two-bytes"
process.env.HOST_PASS_SECRET = secret
const alice = "+14155550123"
const bob = "+14155559999"

function pass(phone) {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `Bearer ${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

test("private API hides other owners before actor work", async () => {
  const calls = []
  const record = { id: "a-alice", owner: alice }
  const store = {
    get: (id) => { calls.push("get"); return record },
    list: () => [record],
    exports: () => [{ id: record.id, actor: { owner: alice } }],
    traceOf: () => { calls.push("trace"); return [] },
    exec: () => { calls.push("exec"); return {} },
    idle: () => { calls.push("idle"); return {} },
    reload: () => { calls.push("reload"); return {} },
    export: () => { calls.push("export"); return {} },
    publish: () => { calls.push("publish"); return {} },
    destroy: () => { calls.push("destroy") },
  }
  const server = makeServer(store)
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  const url = `http://127.0.0.1:${server.address().port}`
  const request = (method, path, authorization) => fetch(url + path, {
    method,
    headers: authorization ? { authorization, "content-type": "application/json" } : {},
    ...(method === "POST" ? { body: JSON.stringify({ argv: ["true"] }) } : {}),
  })
  try {
    const paths = [
      ["GET", "/v1/actors/a-alice"], ["GET", "/v1/actors/a-alice/trace"],
      ...["exec", "idle", "reload", "export", "publish"].map((action) => ["POST", `/v1/actors/a-alice/${action}`]),
      ["DELETE", "/v1/actors/a-alice"],
    ]
    for (const [method, path] of paths) {
      assert.equal((await request(method, path)).status, 401, path)
      assert.equal((await request(method, path, pass(bob))).status, 404, path)
    }
    assert.deepEqual(calls.filter((call) => call !== "get"), [])
    assert.deepEqual((await (await request("GET", "/v1/actors", pass(bob))).json()).actors, [])
    assert.deepEqual((await (await request("GET", "/v1/exports", pass(bob))).json()).exports, [])
    assert.equal((await request("GET", "/v1/actors/a-alice", pass(alice))).status, 200)
  } finally {
    server.closeAllConnections()
    await new Promise((done) => server.close(done))
  }
})
