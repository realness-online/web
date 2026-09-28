import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { connect } from "node:net"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { Door } from "../src/door.js"
import { verify_recovery_pass } from "../../sync/src/recovery-pass.js"
import { verify_model_pass } from "../../proxy/src/model-pass.js"

const root = mkdtempSync(fileURLToPath(new URL("../../../../artifacts/brayness/door-owner-", import.meta.url)))
process.env.HOST_PASS_SECRET = "door-owner-test-secret-at-least-thirty-two-bytes"
process.env.MODEL_PASS_SECRET = "door-model-test-secret-at-least-thirty-two-bytes"

test("VM-bound door ignores a claimed owner and denies actors without one", async () => {
  const record = { id: "a-abcdef123456", owner: "+14155550123", vsockPath: join(root, "vsock.sock") }
  const published = []
  const store = {
    liveActors: () => [record],
    get: () => record,
    publish: async (id, path) => { published.push([id, path]) },
  }
  const door = new Door(store)
  door.reconcile()
  const { path, server } = door.listeners.get(record.id)
  await new Promise((done) => server.listening ? done() : server.once("listening", done))
  const send = (value) => new Promise((done, fail) => {
    const socket = connect(path)
    socket.once("error", fail)
    socket.once("connect", () => socket.write(`${JSON.stringify(value)}\n`))
    let answer = ""
    socket.on("data", (data) => { answer += data.toString() })
    socket.once("end", () => done(JSON.parse(answer)))
  })
  try {
    assert.equal((await send({ op: "publish", owner: "+14155559999", path: "/brayness/site" })).ok, true)
    assert.deepEqual(published, [[record.id, "/brayness/site"]])
    const recovery = await send({ op: "recovery-pass", owner: "+14155559999" })
    assert.equal(recovery.ok, true)
    assert.deepEqual(verify_recovery_pass(recovery.pass, process.env.HOST_PASS_SECRET), { phone: record.owner, id: record.id, paths: null })
    const model = await send({ op: "model-pass", owner: "+14155559999" })
    assert.equal(model.ok, true)
    assert.deepEqual(verify_model_pass(model.pass, process.env.MODEL_PASS_SECRET), { phone: record.owner, id: record.id })
    const loops = []
    door.loops = { start: async (id, goal) => (loops.push([id, goal]), { id: "a-0000000000ff", depth: 1 }) }
    assert.deepEqual(await send({ op: "loop", goal: "faster tests", owner: "+14155559999" }), { ok: true, id: "a-0000000000ff", depth: 1 })
    assert.deepEqual(loops, [[record.id, "faster tests"]])
    record.owner = null
    assert.equal((await send({ op: "loop", goal: "x" })).ok, false)
    assert.equal(loops.length, 1)
    assert.equal((await send({ op: "model-pass" })).ok, false)
    assert.equal((await send({ op: "recovery-pass" })).ok, false)
    assert.equal((await send({ op: "publish", owner: "+14155550123" })).ok, false)
    assert.equal(published.length, 1)
  } finally {
    await new Promise((done) => server.close(done))
    rmSync(root, { recursive: true, force: true })
  }
})
