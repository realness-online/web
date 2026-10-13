import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { NotFound } from "../../../src/host/errors.js"
import { makeServer } from "../../../src/host/server.js"

const secret = "apps-api-test-secret-at-least-thirty-two-bytes-long"
process.env.HOST_PASS_SECRET = secret
const alice = "+14155550123"
const bob = "+14155559999"

function pass(phone) {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `Bearer ${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

async function serve(t) {
  const calls = []
  const actor = { id: "a-alice", owner: alice }
  const app = { id: "app-000000000001", owner: alice, actor: "a-alice", path: "/brayness/work/demo" }
  const store = {
    get: (id) => { if (id !== actor.id) throw new NotFound(id); return actor },
    copyOut: async (id, tree, dest) => calls.push(["copyOut", id, tree]),
  }
  const apps = {
    record: (id) => { if (id !== app.id) throw new NotFound(id); return app },
    list: () => [app],
    status: async (id) => { calls.push(["status", id]); return { ...app, running: true, answering: true } },
    stop: async (id) => calls.push(["stop", id]),
    startFrom: async (copy, meta) => { await copy("/stage"); calls.push(["start", meta]); return { id: "app-000000000002", kind: "node", ...meta } },
  }
  const server = makeServer(store, apps)
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  t.after(() => new Promise((done) => { server.closeAllConnections(); server.close(done) }))
  const url = `http://127.0.0.1:${server.address().port}`
  const request = (method, path, who, body) => fetch(url + path, {
    method,
    headers: who ? { authorization: pass(who), "content-type": "application/json" } : {},
    ...(body && { body: JSON.stringify(body) }),
  })
  return { calls, request }
}

test("apps answer only their owner", async (t) => {
  const { calls, request } = await serve(t)
  const id = "app-000000000001"
  for (const [method, path] of [["GET", "/v1/apps"], ["GET", `/v1/apps/${id}`], ["DELETE", `/v1/apps/${id}`], ["POST", "/v1/apps"]]) {
    assert.equal((await request(method, path)).status, 401, path)
  }
  assert.deepEqual((await (await request("GET", "/v1/apps", bob)).json()).apps, [])
  assert.equal((await request("GET", `/v1/apps/${id}`, bob)).status, 404)
  assert.equal((await request("DELETE", `/v1/apps/${id}`, bob)).status, 404)
  assert.equal((await request("POST", "/v1/apps", bob, { actor: "a-alice", path: "/brayness/work/demo" })).status, 404)
  assert.deepEqual(calls, [])

  assert.equal((await (await request("GET", "/v1/apps", alice)).json()).apps.length, 1)
  assert.equal((await (await request("GET", `/v1/apps/${id}`, alice)).json()).running, true)
  assert.equal((await request("DELETE", `/v1/apps/${id}`, alice)).status, 204)
  assert.deepEqual(calls, [["status", id], ["stop", id]])
})

test("apps start from the owner's work folder only", async (t) => {
  const { calls, request } = await serve(t)
  for (const path of ["/brayness/site", "/etc", "/brayness/work/../../etc", "/brayness/work/", 7]) {
    assert.equal((await request("POST", "/v1/apps", alice, { actor: "a-alice", path })).status, 400, String(path))
  }
  assert.deepEqual(calls, [])
  const response = await request("POST", "/v1/apps", alice, { actor: "a-alice", path: "/brayness/work/demo" })
  assert.equal(response.status, 201)
  assert.equal((await response.json()).owner, alice)
  assert.deepEqual(calls, [["copyOut", "a-alice", "/brayness/work/demo"], ["start", { owner: alice, actor: "a-alice", path: "/brayness/work/demo" }]])
})

test("without an app store, /v1/apps is 404", async () => {
  const server = makeServer({})
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/apps`, { headers: { authorization: pass(alice) } })
    assert.equal(response.status, 404)
  } finally {
    server.closeAllConnections()
    await new Promise((done) => server.close(done))
  }
})
