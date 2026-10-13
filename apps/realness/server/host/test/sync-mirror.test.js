import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { after, before, test } from "node:test"
import { disk } from "#root/src/can/disk.js"
import { dev_issuer } from "#root/src/sync/dev-token.js"
import { rights } from "#root/src/sync/rights.js"
import { sync_service } from "#root/src/sync/server.js"
import { read_status, HostStatus } from "../../../src/host/status.js"
import { SyncMirror } from "../../../src/host/sync-mirror.js"
import { out_path } from "#root/lib/output.js"

const secret = "test-secret-123456789012345678901234567890"
const issuer = dev_issuer()
const dir = out_path(`sync-mirror-test-${randomUUID()}`)
const storage = disk(dir)
let server, url

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put("host-keys/brayness-1", secret)
  server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, host_pass_secret: "phone-secret-12345678901234567890123456789", log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const store = { volume: "/", seedStatus: () => ({ built: true, matches: true }), list: () => [] }

test("host status reaches storage through sync, with no storage key", async () => {
  const mirror = new SyncMirror({ url, secret, host: "brayness-1" })
  assert.equal(await new HostStatus(store, { mirror, host: "brayness-1" }).publish(), true)
  const stored = await storage.get("hosts/brayness-1/status.html")
  assert.equal(read_status(stored.body.toString("utf8")).host.name, "brayness-1")
})

test("loop records write, and a missing stop request reads as null", async () => {
  const mirror = new SyncMirror({ url, secret, host: "brayness-1" })
  await mirror.put("loops/a-0123456789ab/record.html", "<article></article>")
  assert.equal(await mirror.get("loops/a-0123456789ab/stop.html"), null)
  await storage.put("loops/a-0123456789ab/stop.html", "stop")
  assert.equal((await mirror.get("loops/a-0123456789ab/stop.html")).body.toString(), "stop")
})

test("a host cannot write another host's status, and a wrong secret is refused", async () => {
  const mirror = new SyncMirror({ url, secret, host: "brayness-1" })
  await assert.rejects(mirror.put("hosts/brayness-2/status.html", "forged"), /403/)
  const stranger = new SyncMirror({ url, secret: "another-secret-1234567890123456789012345", host: "brayness-1" })
  await assert.rejects(stranger.put("hosts/brayness-1/status.html", "x"), /401/)
})
