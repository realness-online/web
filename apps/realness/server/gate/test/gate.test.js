import { afterEach as after_each, test } from "node:test"
import assert from "node:assert/strict"
import { connect, createServer as create_server } from "node:net"
import { createServer as create_http_server } from "node:http"
import { make_gate, offered_token, one_host } from "#root/src/gate/gate.js"
import { verify_host_pass } from "#root/src/sign-on/node/host-pass.js"
import { Lines } from "#root/lib/lines.js"
import { TEXT, frame, parse } from "#root/lib/websocket.js"

const secret = "g".repeat(32)
const origin = "https://realness-development.web.app"
const phone = "+14155550123"

/** A stand-in for a host's framed terminal: checks the hello, then echoes. */
const fake_host = async () => {
  const hellos = []
  const server = create_server(async (client) => {
    const lines = new Lines(client)
    const hello = JSON.parse((await lines.read(5)).toString())
    hellos.push(hello)
    try {
      if (verify_host_pass(hello.pass, secret).phone !== phone) throw new Error("wrong owner")
    } catch (error) {
      return client.end(`${JSON.stringify({ error: error.message })}\n`)
    }
    client.write('{"ok": true}\n')
    lines.rest()
    client.on("data", (chunk) => client.write(chunk))
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  return { server, hellos, address: `127.0.0.1:${server.address().port}` }
}

const start_gate = async (host_address, identify = async (token) => (token === "good.id.token" ? { phone } : Promise.reject(new Error("bad token")))) => {
  const gate = make_gate({ identify, host_for: one_host(host_address), secret, origins: [origin], log: () => {} })
  await new Promise((done) => gate.listen(0, "127.0.0.1", done))
  return gate
}

const opened = new Set()
after_each(() => {
  for (const socket of opened) socket.destroy()
  opened.clear()
})

/** A browser-shaped upgrade: origin and subprotocols, as a page would send. */
const open = (gate, { protocols = `brayness, good.id.token`, from = origin, path = "/pty?actor=a-000000000001&cols=100&rows=30" } = {}) =>
  new Promise((done, fail) => {
    const socket = connect(gate.address().port, "127.0.0.1")
    opened.add(socket)
    let head = Buffer.alloc(0)
    socket.on("error", fail)
    socket.on("data", function first(chunk) {
      head = Buffer.concat([head, chunk])
      const end = head.indexOf("\r\n\r\n")
      if (end === -1) return
      socket.off("data", first)
      done({ socket, status: Number(head.toString().split(" ")[1]), head: head.subarray(0, end).toString(), rest: head.subarray(end + 4) })
    })
    socket.write(`GET ${path} HTTP/1.1\r\nHost: gate\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nOrigin: ${from}\r\n${protocols ? `Sec-WebSocket-Protocol: ${protocols}\r\n` : ""}\r\n`)
  })

const next_text = (socket, rest) =>
  new Promise((done) => {
    let buffer = rest
    const check = () => {
      const { frames } = parse(buffer)
      const text = frames.find((item) => item.opcode === TEXT)
      if (text) {
        socket.off("data", grow)
        done(text.payload.toString())
      }
    }
    const grow = (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      check()
    }
    socket.on("data", grow)
    check()
  })

test("a signed-in browser reaches its host's terminal through the gate", async () => {
  const host = await fake_host()
  const gate = await start_gate(host.address)
  try {
    const { socket, status, head, rest } = await open(gate)
    assert.equal(status, 101)
    assert.match(head, /Sec-WebSocket-Protocol: brayness\r?$/m)
    assert.deepEqual({ ...host.hellos[0], pass: undefined }, { actor: "a-000000000001", cols: 100, rows: 30, pass: undefined })
    assert.equal(verify_host_pass(host.hellos[0].pass, secret).phone, phone)
    socket.write(frame(TEXT, Buffer.from('{"op":"data","data_b64":"aGk="}')))
    assert.equal(await next_text(socket, rest), '{"op":"data","data_b64":"aGk="}')
    socket.destroy()
  } finally {
    gate.close()
    host.server.close()
  }
})

test("the browser token never reaches the host", async () => {
  const host = await fake_host()
  const gate = await start_gate(host.address)
  try {
    const { socket } = await open(gate)
    assert.ok(!JSON.stringify(host.hellos).includes("good.id.token"))
    socket.destroy()
  } finally {
    gate.close()
    host.server.close()
  }
})

test("another origin, no token, or a bad token is refused before any host", async () => {
  const host = await fake_host()
  const gate = await start_gate(host.address)
  try {
    assert.equal((await open(gate, { from: "https://evil.example" })).status, 403)
    assert.equal((await open(gate, { protocols: "" })).status, 401)
    assert.equal((await open(gate, { protocols: "brayness, bad.id.token" })).status, 401)
    assert.equal((await open(gate, { path: "/pty?cols=80" })).status, 400)
    assert.equal(host.hellos.length, 0)
  } finally {
    gate.close()
    host.server.close()
  }
})

test("a host that refuses the pass is a 502, not a blank terminal", async () => {
  const host = await fake_host()
  const gate = await start_gate(host.address, async () => ({ phone: "+14155550199" }))
  try {
    const { status } = await open(gate)
    assert.equal(status, 502)
  } finally {
    gate.close()
    host.server.close()
  }
})

test("only a brayness subprotocol carries a token", () => {
  assert.equal(offered_token("brayness, a.b.c"), "a.b.c")
  assert.equal(offered_token("other, a.b.c"), null)
  assert.equal(offered_token("brayness"), null)
  assert.equal(offered_token("brayness, a.b.c, extra"), null)
})

/** A stand-in host API: records what arrives, answers JSON, or streams on /v1/stream. */
const fake_api = async () => {
  const seen = []
  const server = create_http_server((request, response) => {
    let body = ""
    request.on("data", (chunk) => (body += chunk))
    request.on("end", () => {
      seen.push({ method: request.method, url: request.url, headers: request.headers, body })
      if (request.url === "/v1/stream") {
        response.writeHead(200, { "content-type": "text/event-stream" })
        response.write("data: one\n\n")
        request.socket.on("close", () => seen.push({ closed: true }))
        return
      }
      response.writeHead(201, { "content-type": "application/json", "access-control-allow-origin": "*" })
      response.end(JSON.stringify({ owner: verify_host_pass(request.headers.authorization.slice(7), secret).phone }))
    })
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  return { server, seen, port: server.address().port }
}

const api_gate = async (api) => {
  const identify = async (token) => (token === "good.id.token" ? { phone } : Promise.reject(new Error("bad token")))
  const gate = make_gate({ identify, host_for: one_host("127.0.0.1:1", api.port), secret, origins: [origin], log: () => {} })
  await new Promise((done) => gate.listen(0, "127.0.0.1", done))
  return { gate, at: `http://127.0.0.1:${gate.address().port}` }
}

test("r2a: a signed-in call reaches the host API under a host pass, not the token", async () => {
  const api = await fake_api()
  const { gate, at } = await api_gate(api)
  const reply = await fetch(`${at}/v1/actors?x=1`, { method: "POST", headers: { authorization: "Bearer good.id.token", origin, cookie: "c=1", "content-type": "application/json" }, body: '{"paths":null}' })
  assert.equal(reply.status, 201)
  assert.equal(reply.headers.get("access-control-allow-origin"), origin)
  assert.deepEqual(await reply.json(), { owner: phone })
  const [call] = api.seen
  assert.deepEqual([call.method, call.url, call.body], ["POST", "/v1/actors?x=1", '{"paths":null}'])
  assert.equal(call.headers.cookie, undefined)
  assert.equal(call.headers.origin, undefined)
  assert.ok(!JSON.stringify(call.headers).includes("good.id.token"))
  gate.close(); api.server.close()
})

test("r2a: other origins, no token, bad tokens, and other paths stop at the gate", async () => {
  const api = await fake_api()
  const { gate, at } = await api_gate(api)
  const auth = { authorization: "Bearer good.id.token" }
  assert.equal((await fetch(`${at}/v1/actors`, { headers: { ...auth, origin: "https://evil.test" } })).status, 403)
  assert.equal((await fetch(`${at}/v1/actors`, { headers: { origin } })).status, 401)
  assert.equal((await fetch(`${at}/v1/actors`, { headers: { authorization: "Bearer bad", origin } })).status, 401)
  assert.equal((await fetch(`${at}/actors`, { headers: { ...auth, origin } })).status, 404)
  const preflight = await fetch(`${at}/v1/actors`, { method: "OPTIONS", headers: { origin } })
  assert.equal(preflight.status, 204)
  assert.match(preflight.headers.get("access-control-allow-headers"), /authorization/)
  assert.equal(api.seen.length, 0)
  gate.close(); api.server.close()
})

test("r2a: a stream passes through, and leaving closes the host call", async () => {
  const api = await fake_api()
  const { gate, at } = await api_gate(api)
  const controller = new AbortController()
  const reply = await fetch(`${at}/v1/stream`, { headers: { authorization: "Bearer good.id.token", origin }, signal: controller.signal })
  const reader = reply.body.getReader()
  assert.equal(new TextDecoder().decode((await reader.read()).value), "data: one\n\n")
  controller.abort()
  for (let i = 0; i < 50 && !api.seen.some((item) => item.closed); i++) await new Promise((done) => setTimeout(done, 20))
  assert.ok(api.seen.some((item) => item.closed))
  gate.close(); api.server.close()
})

test("r2a: an unreachable host is a 502", async () => {
  const { gate, at } = await api_gate({ port: 1 })
  assert.equal((await fetch(`${at}/v1/actors`, { headers: { authorization: "Bearer good.id.token", origin } })).status, 502)
  gate.close()
})
