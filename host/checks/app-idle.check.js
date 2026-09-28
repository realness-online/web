// u6's check, inside the fc-local Lima guest, against the running dev host:
// an app started from a real actor's work folder answers through the host
// while that actor sits idle, and reaching it does not wake the actor.
//
//   sudo node host/checks/app-idle.check.js

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { request } from "node:http"
import { issue_host_pass } from "../src/host-pass.js"

const API = "http://127.0.0.1:8080"
const secret = readFileSync(new URL("../../dist/host-pass-secret", import.meta.url), "utf8").trim()
const alice = "+14155550123"
const call = async (method, path, body) => {
  const response = await fetch(API + path, {
    method, headers: { authorization: `Bearer ${issue_host_pass({ phone: alice }, secret)}`, "content-type": "application/json" }, ...(body && { body: JSON.stringify(body) }),
  })
  const payload = response.status === 204 ? null : await response.json()
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`)
  return payload
}
// fetch drops a caller's Host header; http.request keeps it.
const via = (app, path, cookie) => new Promise((done, fail) => request({ host: "127.0.0.1", port: 8080, path, headers: { host: `${app}.localhost`, ...(cookie && { cookie }) } }, (res) => {
  let body = ""
  res.on("data", (chunk) => (body += chunk)).on("end", () => done({ status: res.statusCode, body, headers: res.headers }))
}).on("error", fail).end())

const server = 'process.getBuiltinModule("node:http").createServer((_, res) => res.end("from the work folder\\n")).listen(process.env.PORT)\n'
let actor
let app
try {
  actor = (await call("POST", "/v1/actors")).id
  console.log(`  ok   actor ${actor}`)
  const script = `mkdir -p /brayness/work/idle-demo && cd /brayness/work/idle-demo && printf '%s' '{"name":"idle-demo"}' > package.json && cat > server.js`
  const made = await call("POST", `/v1/actors/${actor}/exec`, { argv: ["sh", "-c", script], stdin_b64: Buffer.from(server).toString("base64") })
  assert.equal(made.exit_code, 0, Buffer.from(made.stderr_b64 ?? "", "base64").toString())

  app = (await call("POST", "/v1/apps", { actor, path: "/brayness/work/idle-demo" })).id
  console.log(`  ok   app ${app} from /brayness/work/idle-demo`)

  await call("POST", `/v1/actors/${actor}/idle`, { tier: "memory" })
  assert.equal((await call("GET", `/v1/actors/${actor}`)).state, "idle")
  console.log("  ok   actor idles to memory")

  assert.equal((await via(app, "/")).status, 404)
  const link = new URL((await call("POST", `/v1/apps/${app}/enter`)).url)
  const cookie = (await via(app, link.pathname + link.search)).headers["set-cookie"][0].split(";")[0]
  const reply = await via(app, "/", cookie)
  assert.equal(reply.status, 200)
  assert.equal(reply.body, "from the work folder\n")
  assert.equal((await call("GET", `/v1/actors/${actor}`)).state, "idle")
  console.log("  ok   the owner reaches the app through the host; the actor stays idle")
  console.log("app-idle-check: all green")
} finally {
  if (app) await call("DELETE", `/v1/apps/${app}`).catch((error) => console.error(error.message))
  if (actor) await call("DELETE", `/v1/actors/${actor}`).catch((error) => console.error(error.message))
}
