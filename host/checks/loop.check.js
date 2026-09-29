// a1g's check, inside the fc-local Lima guest: a parent actor starts a loop
// with `brayness loop`, reads its report, a loop cannot start a loop, and each
// stop (deadline, owner, Storage request) leaves the loop's actor idle.
//
// The actors volume must be a mount, so this shares the dev host's; it keeps
// its own loops file, door, and API port, and destroys its actors after. The
// dev host must be down: two stores would sweep and seed the same volume.
//
//   sudo node host/checks/loop.check.js
//
// a1j: with a real bucket, the last stop waits for an admin to press Stop on
// the sign-on site's /admin page (sync writes stop.html) instead of faking it.
//
//   sudo ADMIN_ONLY=1 LOOPS_BUCKET=realness-development.appspot.com \
//     LOOPS_ACCESS_TOKEN="$(gcloud auth print-access-token)" node host/checks/loop.check.js

import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { readFileSync, rmSync } from "node:fs"
import { create_gcs } from "../../can-store/src/gcs.js"
import { ActorStore } from "../src/actors.js"
import { Door } from "../src/door.js"
import { Loops } from "../src/loops.js"
import { makeServer } from "../src/server.js"

const owner = "+14156667777"
const secret = readFileSync(new URL("../../dist/host-pass-secret", import.meta.url), "utf8").trim()
process.env.HOST_PASS_SECRET = secret
const pass = () => {
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: owner, exp: Math.floor(Date.now() / 1000) + 240 })).toString("base64url")
  return `Bearer ${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const text = (b64) => Buffer.from(b64 ?? "", "base64").toString().trim()
const ok = (line) => console.log(`  ok   ${line}`)

// Storage, or a stand-in: the admin page writes stop.html; the host writes records.
const real = process.env.LOOPS_BUCKET
const bucket = new Map()
const gcs = real && create_gcs({ bucket: real, token: async () => process.env.LOOPS_ACCESS_TOKEN })
const mirror = {
  put: async (path, body) => (bucket.set(path, body), gcs?.put(path, body)),
  get: async (path) => (gcs ? gcs.get(path) : bucket.get(path) ?? null),
}

const volume = "/opt/fc/actors/mnt"
const file = `${volume}/.loop-check.json`
rmSync(file, { force: true })
const store = new ActorStore({ volume, template: "/opt/fc/template.ext4", kernel: "/opt/fc/vmlinux-6.1.155", firecracker: "/opt/fc/firecracker" })
const loops = new Loops(store, { file, mirror, deadlineMs: 60 * 60_000 })
const door = new Door(store, "/s/{id}/", loops)
const server = makeServer(store, null, undefined, loops)
await new Promise((done) => server.listen(0, "127.0.0.1", done))
const api = (method, path) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { authorization: pass() } })

/** Run argv in an actor as the brayness user, with the door open for it. */
async function sh(id, argv) {
  door.reconcile()
  const { exit_code, stdout_b64, stderr_b64 } = await store.exec(id, ["runuser", "-u", "brayness", "--", ...argv], { cwd: "/" })
  return { code: exit_code, out: text(stdout_b64), err: text(stderr_b64) }
}

async function start(parent, goal) {
  const run = await sh(parent, ["brayness", "loop", goal])
  assert.equal(run.code, 0, run.err)
  const id = run.out.match(/a-[0-9a-z]+/)?.[0]
  assert.ok(id, `no loop id in: ${run.out}`)
  return id
}

/** Stopped, for this reason, with its actor idled. */
function stopped(id, reason) {
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
  // a1c, a1f: one command, a new actor, its own session folder.
  const first = await start(parent, "make the check faster")
  made.push(first)
  assert.equal(loops.loops[first].status, "running")
  assert.equal(loops.loops[first].depth, 1)
  let session
  for (let i = 0; i < 30 && !session; i++) {
    await sleep(1000)
    session = (await sh(first, ["sh", "-c", "cat /brayness/work/loop/goal.md && ls /brayness/work/loop/sessions"])).out
    if (!session.includes("\n")) session = null
  }
  assert.ok(session?.startsWith("make the check faster"), `no goal or session: ${session}`)
  ok(`brayness loop started ${first}; goal and session folder in it`)

  // a1e: the parent reads the report; a probe fills runs and tail.
  await loops.watch()
  const report = await sh(parent, ["brayness", "loop", "report", first])
  assert.equal(report.code, 0, report.err)
  assert.match(report.out, /running/)
  ok("brayness loop report shows it running")

  // Depth: a loop cannot start a loop.
  const nested = await sh(first, ["brayness", "loop", "go deeper"])
  assert.notEqual(nested.code, 0)
  assert.match(nested.err, /nest 1 deep/)
  ok(`loop inside a loop refused: ${nested.err}`)

  // a1d: the deadline stops it.
  await loops.watch(Date.now() + 61 * 60_000)
  stopped(first, "deadline")
  ok("deadline stops the loop; actor idle")

  // a1h: the owner lists and stops their own loop.
  const second = await start(parent, "second goal")
  made.push(second)
  const list = await (await api("GET", "/v1/loops")).json()
  assert.ok(list.loops.some((loop) => loop.id === second && loop.status === "running"))
  const stop = await api("POST", `/v1/loops/${second}/stop`)
  assert.equal(stop.status, 200, await stop.clone().text())
  stopped(second, "owner")
  ok("owner lists and stops a loop over /v1/loops; actor idle")
  }

  // a1i: a stop.html in Storage stops it on the next probe.
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
  rmSync(file, { force: true })
}
