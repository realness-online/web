// u2f's check, inside the fc-local Lima guest: the host API starts, reads,
// and stops a real app VM by id, and hides it from another owner. The actor
// side is a folder copy; publish already proves the copy out of a real actor.
//
//   sudo HOST_PASS_SECRET=... node host/checks/app-api.check.js
//
// Needs net-up.sh, app-image-build.sh, runtime-build.sh. Serves on :8180,
// so a running host on :8080 is left alone.

import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { request } from "node:http"
import { join } from "node:path"
import { AppStore } from "../src/apps.js"
import { NotFound } from "../src/errors.js"
import { issue_host_pass } from "../src/host-pass.js"
import { makeServer } from "../src/server.js"

const secret = (process.env.HOST_PASS_SECRET ||= randomBytes(32).toString("hex"))
const alice = "+14155550123"
const bob = "+14155559999"
const pass = (phone) => `Bearer ${issue_host_pass({ phone }, secret)}`

const fixtures = mkdtempSync("/opt/fc/actors/mnt/.app-api-check-")
mkdirSync(join(fixtures, "demo"))
writeFileSync(join(fixtures, "demo/server.js"), 'process.getBuiltinModule("node:http").createServer((_, res) => res.end("api demo\\n")).listen(process.env.PORT)\n')
writeFileSync(join(fixtures, "demo/package.json"), '{"name": "demo"}\n')
mkdirSync(join(fixtures, "page"))
writeFileSync(join(fixtures, "page/index.html"), "<p>site</p>\n")

const actor = { id: "a-check", owner: alice }
const actors = {
  get: (id) => { if (id !== actor.id) throw new NotFound(id); return actor },
  copyOut: async (id, tree, dest) => cpSync(join(fixtures, tree.slice("/brayness/work/".length)), dest, { recursive: true }),
}
// Its own apps folder, out of reach of a running dev host's sweep.
const apps = new AppStore({ volume: fixtures, kernel: "/opt/fc/vmlinux-6.1.155", firecracker: "/opt/fc/firecracker" })
const server = makeServer(actors, apps)
await new Promise((done) => server.listen(8180, "127.0.0.1", done))
const call = async (method, path, who, body) => {
  const response = await fetch(`http://127.0.0.1:8180${path}`, {
    method, headers: { authorization: pass(who), "content-type": "application/json" }, ...(body && { body: JSON.stringify(body) }),
  })
  return { status: response.status, body: response.status === 204 ? null : await response.json() }
}

let id
try {
  const started = await call("POST", "/v1/apps", alice, { actor: "a-check", path: "/brayness/work/demo" })
  assert.equal(started.status, 201, JSON.stringify(started.body))
  id = started.body.id
  assert.equal(started.body.kind, "node")
  console.log(`  ok   POST starts ${id} at ${started.body.address}:${started.body.port}`)

  const reply = await (await fetch(`http://${started.body.address}:${started.body.port}/`)).text()
  assert.equal(reply, "api demo\n")
  console.log("  ok   the app answers from its own VM")

  // fetch drops a caller's Host header; http.request keeps it.
  const via = (path, cookie) => new Promise((done, fail) => request({ host: "127.0.0.1", port: 8180, path, headers: { host: `${id}.localhost`, ...(cookie && { cookie }) } }, (res) => {
    let body = ""
    res.on("data", (chunk) => (body += chunk)).on("end", () => done({ status: res.statusCode, body, headers: res.headers }))
  }).on("error", fail).end())
  assert.equal((await via("/")).status, 404)
  console.log("  ok   a private app is 404 without its owner's cookie")
  const enter = await call("POST", `/v1/apps/${id}/enter`, alice)
  assert.equal((await call("POST", `/v1/apps/${id}/enter`, bob)).status, 404)
  const link = new URL(enter.body.url)
  const entered = await via(link.pathname + link.search)
  assert.equal(entered.status, 302)
  const cookie = entered.headers["set-cookie"][0].split(";")[0]
  const routed = await via("/", cookie)
  assert.equal(routed.status, 200)
  assert.equal(routed.body, "api demo\n")
  console.log(`  ok   the owner's link opens ${id}.localhost through the host`)
  assert.equal((await call("POST", `/v1/apps/${id}/visibility`, alice, { public: true })).body.public, true)
  assert.equal((await via("/")).status, 200)
  assert.equal((await call("POST", `/v1/apps/${id}/visibility`, alice, { public: false })).body.public, false)
  assert.equal((await via("/")).status, 404)
  console.log("  ok   visibility opens and closes the app")

  const status = await call("GET", `/v1/apps/${id}`, alice)
  assert.equal(status.status, 200)
  assert.equal(status.body.running, true)
  assert.equal(status.body.answering, true)
  console.log("  ok   GET says running and answering")

  const rebooted = await apps.serial(id, () => apps.boot(id))
  assert.equal(rebooted.address, started.body.address)
  assert.equal(rebooted.tap, started.body.tap)
  assert.notEqual(rebooted.pid, started.body.pid)
  assert.equal(await (await fetch(`http://${rebooted.address}:${rebooted.port}/`)).text(), "api demo\n")
  console.log("  ok   a reboot keeps TAP and address, new VM answers")

  assert.deepEqual((await call("GET", "/v1/apps", alice)).body.apps.map((app) => app.id).includes(id), true)
  assert.deepEqual((await call("GET", "/v1/apps", bob)).body.apps, [])
  assert.equal((await call("GET", `/v1/apps/${id}`, bob)).status, 404)
  assert.equal((await call("DELETE", `/v1/apps/${id}`, bob)).status, 404)
  console.log("  ok   another owner sees nothing and stops nothing")

  const site = await call("POST", "/v1/apps", alice, { actor: "a-check", path: "/brayness/work/page" })
  assert.equal(site.status, 201)
  assert.equal(site.body.kind, "site")
  assert.equal(existsSync(apps.path(site.body.id)), false)
  console.log("  ok   a site gets a record and no VM")

  assert.equal((await call("DELETE", `/v1/apps/${id}`, alice)).status, 204)
  assert.equal(existsSync(apps.path(id)), false)
  assert.equal((await call("GET", `/v1/apps/${id}`, alice)).status, 404)
  id = null
  console.log("  ok   DELETE stops the VM and removes its files")
  console.log("app-api-check: all green")
} finally {
  if (id) await apps.stop(id).catch(() => {})
  rmSync(fixtures, { recursive: true, force: true })
  server.closeAllConnections()
  server.close()
}
