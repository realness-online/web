import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { connect } from "node:net"
import { Duplex } from "node:stream"
import { test } from "node:test"
import { makeServer as makePty } from "../src/pty.js"
import { Lines } from "../src/vsock.js"

const secret = "terminal-door-test-secret-at-least-thirty-two-bytes"
process.env.HOST_PASS_SECRET = secret
const phone = "+14155550123"
const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
const pass = `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`

const listen = (server) => new Promise((done) => server.listen(0, "127.0.0.1", done))
const close = (server) => new Promise((done) => server.close(done))

test("framed terminal refuses missing and foreign passes before waking the guest", async () => {
  let wakes = 0
  const server = makePty({
    get: () => ({ id: "a-one", owner: phone }),
    ensureRunning: () => { wakes++; throw new Error("should not wake") },
  })
  await listen(server)
  const sockets = new Set()
  const hello = (credential) => new Promise((done, fail) => {
    const socket = connect(server.address().port, "127.0.0.1")
    sockets.add(socket)
    socket.once("error", fail)
    socket.once("connect", () => socket.write(`${JSON.stringify({ actor: "a-one", pass: credential })}\n`))
    socket.once("data", (data) => { socket.destroy(); done(JSON.parse(data.toString())) })
  })
  try {
    assert.ok((await hello(null)).error)
    assert.ok((await hello("forged")).error)
    assert.equal(wakes, 0)
  } finally {
    for (const socket of sockets) socket.destroy()
    await close(server)
  }
})
