import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { registerHooks } from "node:module"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const state = globalThis.startup_timing_test = { clock: 0, calls: [], running: false }
const modules = {
  "node:perf_hooks": 'export const performance = { now: () => globalThis.startup_timing_test.clock }',
  "firecracker.js": `
    const state = globalThis.startup_timing_test
    export const version = () => "test"
    export const spawn = () => { state.clock += 10; state.running = true; return { pid: 123 } }
    export const waitForApiSocket = async () => { state.clock += 20 }
    export class Api {}
    export const loadSnapshot = async () => { state.clock += 30; state.calls.push("snapshot") }
    export const boot = async () => { state.clock += 60; state.calls.push("boot") }
    export const pidForApiSock = () => state.running ? 123 : null
    export const terminate = async () => { state.running = false }
  `,
  "host.js": `
    import { copyFileSync } from "node:fs"
    export const requireRoot = () => {}
    export const requireMount = () => {}
    export const shortEnoughForUnix = () => true
    export const run = argv => { if (argv[0] === "cp") copyFileSync(argv[2], argv[3]); return { code: 0, output: "" } }
    export const freeTap = () => "fc-tap1"
    export const createTap = () => {}
    export const deleteTap = () => {}
    export const ensureTap = () => false
    export const tapGuest = () => "172.16.1.2"
  `,
  "vsock.js": `
    const state = globalThis.startup_timing_test
    export const VSOCK_PORT = 52
    export const waitForAgent = async () => {
      state.clock += 40
      if (state.fail_agent) throw new Error("guest unavailable")
    }
    export const execInGuest = async () => { state.clock += 50; return { code: 0, out: Buffer.from("ready"), err: Buffer.alloc(0) } }
    export const runOk = async () => { state.clock += 5; return "machine actor boot 1" }
  `,
}
const hooks = registerHooks({
  resolve(specifier, context, next) {
    const key = specifier === "node:perf_hooks" ? specifier : specifier.split("/").at(-1)
    if (context.parentURL?.endsWith("/src/actors.js") && Object.hasOwn(modules, key)) {
      return { url: `data:text/javascript,${encodeURIComponent(modules[key])}`, shortCircuit: true }
    }
    return next(specifier, context)
  },
})
const { ActorStore } = await import("../src/actors.js")
hooks.deregister()

const scratch = fileURLToPath(new URL("../../../../../artifacts/brayness-host-scale/test-data/", import.meta.url))
mkdirSync(scratch, { recursive: true })

function fixture(t) {
  state.clock = 0
  state.calls = []
  state.running = false
  state.fail_agent = false
  const volume = mkdtempSync(join(scratch, "timing-"))
  t.after(() => rmSync(volume, { recursive: true, force: true }))
  const store = new ActorStore({ volume, firecracker: "test" })
  mkdirSync(store.seedDir)
  writeFileSync(join(store.seedDir, "rootfs.ext4"), "disk")
  store.ensureSeed = async () => { state.clock += 7; return { matches: true } }
  return store
}

function fields(store, id, event) {
  const trace = store.traceOf(id).find(row => row.event === event)
  assert.ok(trace, `${event} trace exists`)
  return Object.fromEntries(["vm_ms", "agent_ms", "init_ms", "ms"].map(key => [key, trace[key]]))
}

test("create separates VM load, guest response, initialization, and total", async t => {
  const store = fixture(t)
  const actor = await store.create("+14156667777")
  assert.deepEqual(fields(store, actor.id, "create"), { vm_ms: 60, agent_ms: 40, init_ms: 55, ms: 162 })
  assert.deepEqual(state.calls, ["snapshot"])
})

for (const from_memory of [true, false]) {
  test(`reload records ${from_memory ? "memory restore" : "disk boot"} separately`, async t => {
    const store = fixture(t)
    const actor = await store.create("+14156667777")
    if (from_memory) {
      writeFileSync(join(actor.dir, "state"), "snapshot")
      writeFileSync(join(actor.dir, "mem"), "memory")
    }
    state.running = false
    state.calls = []
    const restored = await store.reload(actor.id)
    const vm_ms = from_memory ? 60 : 90
    assert.deepEqual(fields(store, restored.id, "reload"), { vm_ms, agent_ms: 40, init_ms: 55, ms: vm_ms + 95 })
    assert.equal(store.traceOf(actor.id).find(row => row.event === "reload").from_memory, from_memory)
    assert.deepEqual(state.calls, [from_memory ? "snapshot" : "boot"])
  })
}

test("lock queue time is excluded from actor creation time", async t => {
  const store = fixture(t)
  store.lock.run = work => { state.clock += 1000; return work() }
  const actor = await store.create("+14156667777")
  assert.equal(fields(store, actor.id, "create").ms, 162)
})

test("failed guest startup does not produce a successful create measurement", async t => {
  const store = fixture(t)
  state.fail_agent = true
  await assert.rejects(store.create("+14156667777"), /guest unavailable/)
  assert.equal(store.list().length, 0)
  assert.equal(state.running, false)
})

test("failed guest restore does not produce a successful reload measurement", async t => {
  const store = fixture(t)
  const actor = await store.create("+14156667777")
  writeFileSync(join(actor.dir, "state"), "snapshot")
  writeFileSync(join(actor.dir, "mem"), "memory")
  state.running = false
  state.fail_agent = true
  await assert.rejects(store.reload(actor.id), /guest unavailable/)
  assert.equal(store.traceOf(actor.id).filter(row => row.event === "reload").length, 0)
  assert.equal(state.running, false)
})

test("already running actors do not produce a restore measurement", async t => {
  const store = fixture(t)
  const actor = await store.create("+14156667777")
  await store.reload(actor.id)
  assert.equal(store.traceOf(actor.id).filter(row => row.event === "reload").length, 0)
})
