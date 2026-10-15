
import assert from "node:assert/strict"
import { createHmac as create_hmac } from "node:crypto"
import { readFileSync as read_file_sync, rmSync as rm_sync } from "node:fs"
import { create_gcs } from "#root/src/can/gcs.js"
import { ActorStore } from "../../../src/host/actors.js"
import { Door } from "../../../src/host/door.js"
import { Loops } from "../../../src/host/loops.js"
import { makeServer as make_server } from "../../../src/host/server.js"
import { out_path } from "#root/lib/output.js"

const owner = "+14156667777"
const secret = read_file_sync(out_path("host-pass-secret"), "utf8").trim()
process.env.HOST_PASS_SECRET = secret
const pass = () => {
  const body = Buffer.from(JSON.stringify({ aud: "realness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `Bearer ${body}.${create_hmac("sha256", secret).update(body).digest("base64url")}`
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const text = (b64) => Buffer.from(b64 ?? "", "base64").toString().trim()
const ok = (line) => console.log(`  ok   ${line}`)

const real = process.env.LOOPS_BUCKET
const bucket = new Map()
const gcs = real
  ? create_gcs({ bucket: real, token: async () => process.env.LOOPS_ACCESS_TOKEN })
  : null
const mirror = {
  put: async (path, body) => (bucket.set(path, body), gcs?.put(path, body)),
  get: async (path) => (gcs ? gcs.get(path) : bucket.get(path) ?? null),
}

const volume = "/opt/fc/actors/mnt"
const file = `${volume}/.loop-check.json`
rm_sync(file, { force: true })
const store = new ActorStore({ volume, template: "/opt/fc/template.ext4", kernel: "/opt/fc/vmlinux-6.1.155", firecracker: "/opt/fc/firecracker" })
const loops = new Loops(store, { file, mirror, deadlineMs: 60 * 60_000 })
const door = new Door(store, "/s/{id}/", loops)
const server = make_server(store, null, undefined, loops)
/** @type {Promise<void>} */
const listening = new Promise(resolve => {
  server.listen(0, "127.0.0.1", () => resolve())
})
await listening
const address = server.address()
if (!address || typeof address === "string")
  throw new Error("the check server is not on a TCP port")
const api = (method, path) => fetch(`http://127.0.0.1:${address.port}${path}`, { method, headers: { authorization: pass() } })

/** Run argv in an actor as the realness user, with the door open for it. */
const sh = async (id, argv) => {
  door.reconcile()
  const { exit_code, stdout_b64, stderr_b64 } = await store.exec(id, ["runuser", "-u", "realness", "--", ...argv], { cwd: "/" })
  return { code: exit_code, out: text(stdout_b64), err: text(stderr_b64) }
}

const start = async (parent, goal) => {
  const run = await sh(parent, ["realness", "loop", goal])
  assert.equal(run.code, 0, run.err)
  const id = run.out.match(/a-[0-9a-z]+/)?.[0]
  assert.ok(id, `no loop id in: ${run.out}`)
  return id
}

/** Stopped, for this reason, with its actor idled. */
const stopped = (id, reason) => {
  assert.equal(loops.loops[id].status, "stopped")
  assert.equal(loops.loops[id].reason, reason)
  assert.equal(store.get(id).state, "idle")
  assert.match(bucket.get(`loops/${id}/record.html`), /itemprop="status" content="stopped"/)
}

const made = []
try {
  await store.ensureSeed()
  const parent = (await store.create(owner)).id
  made.push(parent)
  ok(`parent ${parent}`)

  if (!process.env.ADMIN_ONLY) {
  const first = await start(parent, "make the check faster")
  made.push(first)
  assert.equal(loops.loops[first].status, "running")
  assert.equal(loops.loops[first].depth, 1)
  let session
  for (let i = 0; i < 30 && !session; i++) {
    await sleep(1000)
    session = (await sh(first, ["sh", "-c", "cat /realness/work/loop/goal.md && ls /realness/work/loop/sessions"])).out
    if (!session.includes("\n")) session = null
  }
  assert.ok(session?.startsWith("make the check faster"), `no goal or session: ${session}`)
  ok(`realness loop started ${first}; goal and session folder in it`)

  await loops.watch()
  const report = await sh(parent, ["realness", "loop", "report", first])
  assert.equal(report.code, 0, report.err)
  assert.match(report.out, /running/)
  ok("realness loop report shows it running")

  const nested = await sh(first, ["realness", "loop", "go deeper"])
  assert.notEqual(nested.code, 0)
  assert.match(nested.err, /nest 1 deep/)
  ok(`loop inside a loop refused: ${nested.err}`)

  await loops.watch(Date.now() + 61 * 60_000)
  stopped(first, "deadline")
  ok("deadline stops the loop; actor idle")

  const second = await start(parent, "second goal")
  made.push(second)
  const list = await (await api("GET", "/v1/loops")).json()
  assert.ok(list.loops.some((loop) => loop.id === second && loop.status === "running"))
  const stop = await api("POST", `/v1/loops/${second}/stop`)
  assert.equal(stop.status, 200, await stop.clone().text())
  stopped(second, "owner")
  ok("owner lists and stops a loop over /v1/loops; actor idle")
  }

  const third = await start(parent, process.env.ADMIN_ONLY ? "admin stop check" : "third goal")
  made.push(third)
  if (!gcs) {
    bucket.set(`loops/${third}/stop.html`, "<p>stop</p>")
    await loops.watch()
  } else {
    console.log(`  ..   press Stop on ${third} at /admin; waiting ten minutes`)
    for (let i = 0; i < 120 && loops.loops[third].status === "running"; i++) {
      await sleep(5000)
      await loops.watch()
    }
  }
  stopped(third, "admin")
  ok(`stop.html in ${gcs ? `gs://${real}` : "Storage"} stops the loop on the next probe; actor idle`)

  console.log("loop-check: all green")
} finally {
  clearTimeout(door.timer)
  for (const { server } of door.listeners.values()) server.close()
  server.close()
  for (const id of made) {
    try {
      await store.destroy(id)
    } catch (error) {
      console.error(`cleanup ${id}: ${error.message}`)
    }
  }
  rm_sync(file, { force: true })
}
