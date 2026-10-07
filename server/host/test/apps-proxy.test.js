import assert from "node:assert/strict"
import { createServer, request } from "node:http"
import { test } from "node:test"
import { NotFound } from "../src/errors.js"
import { makeServer } from "../src/server.js"
import { app_auth } from "../src/app-auth.js"

process.env.HOST_PASS_SECRET ||= "apps-proxy-test-secret-at-least-thirty-two-bytes"
const alice = "+14155550123"
const listen = (server) => new Promise((done) => server.listen(0, "127.0.0.1", () => done(server.address().port)))

async function setup(t) {
  // Stands in for an app VM: streams a reply, echoes a body, and upgrades.
  const upstream = createServer((req, res) => {
    if (req.url === "/headers" || req.url === "/cookie") return res.end(req.headers.cookie ?? "")
    if (req.url === "/stream") {
      res.writeHead(200, { "x-app": "yes" })
      res.write("one\n")
      setTimeout(() => res.end("two\n"), 50)
      return
    }
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk)).on("end", () => res.end(`${req.method} ${req.url} ${req.headers["x-forwarded-host"]} ${Buffer.concat(chunks)}`))
  })
  upstream.on("upgrade", (req, socket) => {
    socket.write("HTTP/1.1 101 Switching Protocols\r\nupgrade: echo\r\nconnection: upgrade\r\n\r\n")
    socket.pipe(socket)
  })
  const appPort = await listen(upstream)
  const records = {
    "app-000000000001": { id: "app-000000000001", kind: "node", address: "127.0.0.1", port: appPort, owner: alice, public: true },
    "app-000000000004": { id: "app-000000000004", kind: "node", address: "127.0.0.1", port: appPort, owner: alice },
    "app-000000000002": { id: "app-000000000002", kind: "node", address: "127.0.0.1", port: appPort, owner: alice, public: true, state: "crashed" },
    "app-000000000003": { id: "app-000000000003", kind: "site" },
  }
  const apps = { record: (id) => records[id] ?? (() => { throw new NotFound(id) })() }
  const auth = app_auth(process.env.HOST_PASS_SECRET)
  const server = makeServer({}, apps, auth)
  const port = await listen(server)
  t.after(() => {
    for (const s of [server, upstream]) { s.closeAllConnections(); s.close() }
  })
  const call = (host, path = "/", options = {}) => new Promise((done, fail) => {
    const req = request({ host: "127.0.0.1", port, path, headers: { host }, ...options }, (res) => {
      const chunks = []
      res.on("data", (chunk) => chunks.push(chunk)).on("end", () => done({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString(), chunks: chunks.length }))
    })
    req.on("error", fail)
    req.end(options.body)
  })
  return { call, port, auth }
}

test("an app host proxies requests and streams replies", async (t) => {
  const { call } = await setup(t)
  const echo = await call("app-000000000001.localhost:8080", "/a?b=1", { method: "POST", body: "hi" })
  assert.equal(echo.status, 200)
  assert.equal(echo.body, "POST /a?b=1 app-000000000001.localhost:8080 hi")
  const stream = await call("app-000000000001.localhost", "/stream")
  assert.equal(stream.headers["x-app"], "yes")
  assert.equal(stream.body, "one\ntwo\n")
  assert.ok(stream.chunks >= 2, "reply arrives in pieces, not buffered")
})

test("unknown, crashed, and site apps do not proxy", async (t) => {
  const { call } = await setup(t)
  assert.equal((await call("app-00000000000f.localhost")).status, 404)
  assert.equal((await call("app-000000000002.localhost")).status, 503)
  assert.equal((await call("app-000000000003.localhost")).status, 404)
  assert.equal((await call("app-nothex.localhost")).status, 404)
})

test("upgrades splice through to the app", async (t) => {
  const { port } = await setup(t)
  const socket = await new Promise((done, fail) => {
    const req = request({ host: "127.0.0.1", port, headers: { host: "app-000000000001.localhost", connection: "upgrade", upgrade: "echo" } })
    req.on("upgrade", (res, sock) => { assert.equal(res.statusCode, 101); done(sock) })
    req.on("response", (res) => fail(new Error(`no upgrade: ${res.statusCode}`)))
    req.on("error", fail)
    req.end()
  })
  socket.write("ping")
  const [reply] = await new Promise((done) => socket.once("data", (data) => done([data.toString()])))
  assert.equal(reply, "ping")
  socket.destroy()
})

test("a private app answers only its owner's cookie, which it never sees", async (t) => {
  const { call, auth } = await setup(t)
  const host = "app-000000000004.localhost"
  assert.equal((await call(host)).status, 404)
  assert.equal((await call(host, "/.brayness/enter?ticket=nope")).status, 403)
  const other = auth.issue(alice, "app-000000000001")
  assert.equal((await call(host, `/.brayness/enter?ticket=${other}`)).status, 403, "a ticket is bound to its app")
  const ticket = auth.issue(alice, "app-000000000004")
  const entered = await call(host, `/.brayness/enter?ticket=${ticket}`)
  assert.equal(entered.status, 302)
  const cookie = entered.headers["set-cookie"][0].split(";")[0]
  assert.match(entered.headers["set-cookie"][0], /HttpOnly/)
  assert.equal((await call(host, `/.brayness/enter?ticket=${ticket}`)).status, 403, "tickets are one-use")
  const seen = await call(host, "/", { method: "POST", headers: { host, cookie: `theirs=1; ${cookie}` }, body: "x" })
  assert.equal(seen.status, 200)
  const echoed = await call(host, "/cookie", { headers: { host, cookie: `theirs=1; ${cookie}` } })
  assert.equal(echoed.status, 200)
  assert.equal((await call("app-000000000001.localhost", "/", { headers: { host: "app-000000000001.localhost", cookie } })).status, 200, "public app still answers")
  const crashedPrivate = await call("app-000000000002.localhost")
  assert.equal(crashedPrivate.status, 503)
})

test("the proxy strips the owner cookie before the app", async (t) => {
  const { call, auth } = await setup(t)
  const host = "app-000000000004.localhost"
  const entered = await call(host, `/.brayness/enter?ticket=${auth.issue(alice, "app-000000000004")}`)
  const cookie = entered.headers["set-cookie"][0].split(";")[0]
  const reply = await call(host, "/headers", { headers: { host, cookie: `theirs=1; ${cookie}` } })
  assert.equal(reply.status, 200)
  assert.equal(reply.body, "theirs=1")
})
