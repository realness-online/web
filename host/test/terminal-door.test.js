import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { connect } from "node:net"
import { Duplex } from "node:stream"
import { test } from "node:test"
import { makeServer as makePty } from "../src/pty.js"
import { makeServer as makeWebterm } from "../src/webterm.js"
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

test("browser page needs a cookie, and tickets need a same-origin request", async () => {
  const server = makeWebterm({ pageRoot: ".", chatRoot: new URL("./fixtures/chat", import.meta.url).pathname, streamPort: 1, store: {
    get: (id) => ({ id, owner: id === "a-one" ? phone : "+14155559999" }),
  }, newActor: () => { throw new Error("should not create") } })
  await listen(server)
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(`${base}/?actor=a-one`)).status, 401)
    assert.equal((await fetch(`${base}/chat?actor=a-one`)).status, 401)
    assert.equal((await fetch(`${base}/chat/index.html?actor=a-one`)).status, 401)
    const exchange = await fetch(`${base}/auth`, { method: "POST", headers: { origin: base }, body: JSON.stringify({ pass }) })
    assert.equal(exchange.status, 204)
    const cookie = exchange.headers.get("set-cookie").split(";")[0]
    assert.equal((await fetch(`${base}/?actor=a-one`, { headers: { cookie } })).status, 503)
    assert.equal((await fetch(`${base}/?actor=a-foreign`, { headers: { cookie } })).status, 404)
    assert.equal((await fetch(`${base}/chat?actor=a-foreign`, { headers: { cookie } })).status, 404)
    assert.equal((await fetch(`${base}/chat?actor=a-one`, { headers: { cookie } })).status, 200)
    assert.equal((await fetch(`${base}/chat/index.html?actor=a-foreign`, { headers: { cookie } })).status, 404)
    assert.equal((await fetch(`${base}/ticket?actor=a-foreign`, { method: "POST", headers: { cookie, origin: base } })).status, 404)
    assert.equal((await fetch(`${base}/ticket?actor=a-one`, { method: "POST", headers: { cookie } })).status, 403)
    const ticket = await fetch(`${base}/ticket?actor=a-one`, { method: "POST", headers: { cookie, origin: base } })
    assert.equal(ticket.status, 200)
    assert.ok((await ticket.json()).ticket)
  } finally {
    server.closeAllConnections()
    await close(server)
  }
})

test("chat streams only for the actor's owner, after a same-origin request", async () => {
  let wakes = 0
  const messages = []
  const server = makeWebterm({ pageRoot: ".", streamPort: 1, store: {
    get: (id) => ({ id, owner: id === "a-one" ? phone : "+14155559999" }),
    ensureRunning: (id) => { wakes++; return { id } },
    beginWork: () => {}, endWork: () => {},
  }, connectChat: async () => {
    const socket = new Duplex({
      read() {},
      write(chunk, encoding, done) {
        messages.push(JSON.parse(chunk.toString()).message)
        this.push('{"type":"delta","text":"Hello"}\n{"type":"done"}\n')
        this.push(null)
        done()
      },
    })
    return { socket, lines: new Lines(socket) }
  } })
  await listen(server)
  const base = `http://127.0.0.1:${server.address().port}`
  const post = (actor, headers = {}, body = '{"message":"Hi"}') => fetch(`${base}/chat/message?actor=${actor}`, { method: "POST", headers, body })
  try {
    assert.equal((await post("a-one")).status, 401)
    const exchange = await fetch(`${base}/auth`, { method: "POST", headers: { origin: base }, body: JSON.stringify({ pass }) })
    const cookie = exchange.headers.get("set-cookie").split(";")[0]
    assert.equal((await post("a-foreign", { cookie, origin: base })).status, 404)
    assert.equal((await post("a-one", { cookie })).status, 403)
    assert.equal((await post("a-one", { cookie, origin: base }, '{"message":null}')).status, 400)
    assert.equal(wakes, 0)
    const reply = await post("a-one", { cookie, origin: base })
    assert.equal(reply.status, 200)
    assert.deepEqual((await reply.text()).trim().split("\n").map(JSON.parse), [{ type: "delta", text: "Hello" }, { type: "done" }])
    assert.deepEqual(messages, ["Hi"])
    assert.equal(wakes, 1)
  } finally {
    server.closeAllConnections()
    await close(server)
  }
})

test("the first accepted chat message records the first turn, once", async () => {
  const turns = []
  const server = makeWebterm({ pageRoot: ".", streamPort: 1, store: {
    get: (id) => ({ id, owner: phone }),
    ensureRunning: (id) => ({ id }),
    beginWork: () => {}, endWork: () => {},
    firstTurn: (id) => turns.push(id),
  }, connectChat: async () => {
    const socket = new Duplex({ read() {}, write(chunk, encoding, done) { this.push(null); done() } })
    return { socket, lines: new Lines(socket) }
  } })
  await listen(server)
  const base = `http://127.0.0.1:${server.address().port}`
  const post = (body) => fetch(`${base}/chat/message?actor=a-one`, { method: "POST", headers: { cookie, origin: base }, body })
  let cookie
  try {
    const exchange = await fetch(`${base}/auth`, { method: "POST", headers: { origin: base }, body: JSON.stringify({ pass }) })
    cookie = exchange.headers.get("set-cookie").split(";")[0]
    assert.equal((await post('{"message":null}')).status, 400)
    assert.deepEqual(turns, [])
    assert.equal((await post('{"message":"Hi"}')).status, 200)
    assert.equal((await post('{"message":"Again"}')).status, 200)
    assert.deepEqual(turns, ["a-one", "a-one"])
  } finally {
    server.closeAllConnections()
    await close(server)
  }
})

test("chat events stream the session to the owner, without holding the actor awake", async () => {
  const requests = []
  let work = 0
  const server = makeWebterm({ pageRoot: ".", streamPort: 1, store: {
    get: (id) => ({ id, owner: id === "a-one" ? phone : "+14155559999" }),
    ensureRunning: (id) => ({ id }),
    beginWork: () => work++, endWork: () => {},
  }, connectChat: async () => {
    const socket = new Duplex({
      read() {},
      write(chunk, encoding, done) {
        requests.push(JSON.parse(chunk.toString()))
        this.push('{"type":"history","messages":[]}\n{"type":"user","text":"typed"}\n')
        this.push(null)
        done()
      },
    })
    return { socket, lines: new Lines(socket) }
  } })
  await listen(server)
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(`${base}/chat/events?actor=a-one`)).status, 401)
    const exchange = await fetch(`${base}/auth`, { method: "POST", headers: { origin: base }, body: JSON.stringify({ pass }) })
    const cookie = exchange.headers.get("set-cookie").split(";")[0]
    assert.equal((await fetch(`${base}/chat/events?actor=a-foreign`, { headers: { cookie } })).status, 404)
    const reply = await fetch(`${base}/chat/events?actor=a-one`, { headers: { cookie } })
    assert.deepEqual((await reply.text()).trim().split("\n").map(JSON.parse), [{ type: "history", messages: [] }, { type: "user", text: "typed" }])
    assert.deepEqual(requests, [{ watch: true }])
    assert.equal(work, 0)
  } finally {
    server.closeAllConnections()
    await close(server)
  }
})

test("b1c: chat limit answers only the owner, with the proxy's warning", async () => {
  const asked = []
  const server = makeWebterm({ pageRoot: ".", streamPort: 1, store: {
    get: (id) => ({ id, owner: id === "a-one" ? phone : "+14155559999" }),
  }, limits: async (record) => (asked.push(record), { warn: { limit: "day", percent: 92, message: "92% ... https://pay" } }) })
  await listen(server)
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(`${base}/chat/limit?actor=a-one`)).status, 401)
    const exchange = await fetch(`${base}/auth`, { method: "POST", headers: { origin: base }, body: JSON.stringify({ pass }) })
    const cookie = exchange.headers.get("set-cookie").split(";")[0]
    assert.equal((await fetch(`${base}/chat/limit?actor=a-foreign`, { headers: { cookie } })).status, 404)
    const reply = await fetch(`${base}/chat/limit?actor=a-one`, { headers: { cookie } })
    assert.equal((await reply.json()).warn.percent, 92)
    assert.deepEqual(asked, [{ id: "a-one", owner: phone }])
  } finally {
    server.closeAllConnections()
    await close(server)
  }
})

test("b1c: chat limit is quiet when the proxy cannot answer", async () => {
  const server = makeWebterm({ pageRoot: ".", streamPort: 1, store: { get: (id) => ({ id, owner: phone }) }, limits: async () => { throw new Error("down") } })
  await listen(server)
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const exchange = await fetch(`${base}/auth`, { method: "POST", headers: { origin: base }, body: JSON.stringify({ pass }) })
    const cookie = exchange.headers.get("set-cookie").split(";")[0]
    assert.deepEqual(await (await fetch(`${base}/chat/limit?actor=a-one`, { headers: { cookie } })).json(), { warn: null })
  } finally {
    server.closeAllConnections()
    await close(server)
  }
})
