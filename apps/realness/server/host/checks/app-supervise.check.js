
import assert from "node:assert/strict"
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, readFileSync as read_file_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from "node:fs"
import { join } from "node:path"
import { AppStore } from "../../../src/host/apps.js"
import * as firecracker from "../../../src/host/firecracker.js"
import * as host from "../../../src/host/host.js"

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const get = (record, path = "/") => fetch(`http://${record.address}:${record.port}${path}`, { signal: AbortSignal.timeout(2000) }).then((r) => r.text()).catch(() => null)
const vmPid = (id) => firecracker.pidForApiSock(apps.path(id, "api.sock"))

/** Sweep until the app answers with a new boot id, or fail after `seconds`. */
const returns = async (record, before, seconds = 90) => {
  const deadline = Date.now() + seconds * 1000
  while (Date.now() < deadline) {
    const steps = await apps.sweep()
    for (const { step } of steps) console.log(`       sweep: ${step}`)
    const now = await get(record)
    if (now && now !== before) return now
    await sleep(1000)
  }
  throw new Error(`${record.id} did not come back in ${seconds}s`)
}

const fixtures = mkdtemp_sync("/opt/fc/actors/mnt/.app-supervise-check-")
const options = { volume: fixtures, kernel: "/opt/fc/vmlinux-6.1.155", firecracker: "/opt/fc/firecracker" }
let apps = new AppStore(options)
const app = join(fixtures, "app")
mkdir_sync(app)
write_file_sync(join(app, "package.json"), '{"name": "supervised"}\n')
write_file_sync(join(app, "server.js"), `
const boot = crypto.randomUUID()
const hog = []
export default {
  fetch(request) {
    const path = new URL(request.url).pathname
    if (path === "/exit") { setTimeout(() => process.exit(1), 50); return new Response("bye\\n") }
    if (path === "/oom") { setInterval(() => hog.push(Buffer.alloc(16 << 20, 1)), 10); return new Response("eating\\n") }
    return new Response(boot + "\\n")
  },
}
`)
const loop = join(fixtures, "loop")
mkdir_sync(loop)
write_file_sync(join(loop, "package.json"), '{"name": "loop"}\n')
write_file_sync(join(loop, "server.js"), 'setTimeout(() => process.exit(1), 1500)\nexport default { fetch: () => new Response("x\\n") }\n')

const ids = []
try {
  const record = await apps.start(app, { owner: "+14155550123" })
  ids.push(record.id)
  let boot = await get(record)
  assert.ok(boot)
  console.log(`  ok   ${record.id} answers at ${record.address}`)

  process.kill(vmPid(record.id), "SIGKILL")
  boot = await returns(record, boot)
  console.log("  ok   killed VM returns, same address")

  await get(record, "/exit")
  boot = await returns(record, boot)
  console.log("  ok   exited app returns")

  await get(record, "/oom")
  let peak = 0
  const watch = setInterval(() => {
    const pid = vmPid(record.id)
    const status = pid && read_file_sync(`/proc/${pid}/status`, "utf8").match(/VmRSS:\s+(\d+)/)
    if (status) peak = Math.max(peak, Number(status[1]) >> 10)
  }, 200)
  try {
    boot = await returns(record, boot)
  } finally {
    clearInterval(watch)
  }
  assert.ok(peak <= record.mib + 64, `VM resident ${peak} MiB, cap ${record.mib}`)
  console.log(`  ok   out-of-memory app returns; VM peaked at ${peak} MiB (cap ${record.mib})`)

  await firecracker.terminate(vmPid(record.id))
  host.deleteTap(record.tap)
  apps = new AppStore(options)
  boot = await returns(record, boot)
  console.log("  ok   host restart brings the app back")

  const looping = await apps.start(loop, { owner: "+14155550123" })
  ids.push(looping.id)
  let now = Date.now()
  let state
  for (let pass = 0; pass < 60 && state !== "crashed"; pass++) {
    await sleep(700)
    now += 20_000
    await apps.sweep(now)
    state = apps.record(looping.id).state
  }
  assert.equal(state, "crashed")
  assert.equal(apps.record(looping.id).restarts.length, 5)
  assert.equal(vmPid(looping.id), null)
  console.log("  ok   a crash loop stops at crashed after five restarts")
  console.log("app-supervise-check: all green")
} finally {
  for (const id of ids) await apps.stop(id).catch(() => {})
  rm_sync(fixtures, { recursive: true, force: true })
}
