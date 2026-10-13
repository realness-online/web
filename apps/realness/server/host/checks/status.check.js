
import assert from "node:assert/strict"
import { create_gcs } from "#root/src/can/gcs.js"
import { ActorStore } from "../../../src/host/actors.js"
import { HostStatus, read_status } from "../../../src/host/status.js"

const bucket = process.env.LOOPS_BUCKET
const token = process.env.LOOPS_ACCESS_TOKEN
if (!bucket || !token) {
  console.error("usage: LOOPS_BUCKET=<bucket> LOOPS_ACCESS_TOKEN=<token> node server/host/checks/status.check.js")
  process.exit(2)
}

const store = new ActorStore({ volume: "/opt/fc/actors/mnt", template: "/opt/fc/template.ext4", kernel: "/opt/fc/vmlinux-6.1.155", firecracker: "/opt/fc/firecracker" })
const mirror = create_gcs({ bucket, token: async () => token })
const warned = []
const status = new HostStatus(store, { mirror, warn: (message) => warned.push(message) })

assert.equal(await status.publish(), true, warned.join("; "))
const stored = await mirror.get(`hosts/${status.host}/status.html`)
const read = read_status(stored.body.toString("utf8"))
assert.equal(read.host.name, status.host)
assert.equal(read.actors.length, store.list().length)
assert.ok(Number(read.host.mem_total) > 0 && Number(read.host.volume_size) > 0)
console.log(`  ok   hosts/${status.host}/status.html: checked ${read.host.checked}, seed ${read.host.seed}, ${read.actors.length} actors`)
