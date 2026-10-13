import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { disk } from "#root/src/can/disk.js"
import { client } from "#root/src/files/client.js"
import { out_path } from "#root/lib/output.js"
import { dev_issuer } from "../../../src/sync/dev-token.js"
import { read_changes, record_change } from "../../../src/sync/changes.js"
import { rights } from "../../../src/sync/rights.js"
import { sync_service } from "../../../src/sync/server.js"

const dir = out_path(`changes-test-${randomUUID()}`)
const issuer = dev_issuer()
const phone = "+15555550177"
let server, storage, url

before(async () => {
  await mkdir(join(dir, "bucket"), { recursive: true })
  storage = disk(join(dir, "bucket"))
  server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }) })

const harness = async (name, files) => {
  const root = join(dir, name)
  for (const [path, body] of Object.entries(files)) {
    await mkdir(join(root, path, ".."), { recursive: true })
    await writeFile(join(root, path), body)
  }
  await mkdir(root, { recursive: true })
  return root
}

test("a second harness learns an edit and a delete from the feed, not a walk", async () => {
  const store = client({ url, token: issuer.token(phone) })
  const desktop = await harness("desktop", { "a.md": "a", "b.md": "b" })
  const vm = await harness("vm", {})
  const sync = (root, state) => store.sync(root, "can://~/harness/", { state, deletes: "all" })

  assert.equal((await sync(desktop, join(dir, "s-desktop"))).listing, "walk")
  assert.equal((await sync(vm, join(dir, "s-vm"))).listing, "walk")
  assert.equal(await readFile(join(vm, "b.md"), "utf8"), "b")

  await writeFile(join(desktop, "a.md"), "edited")
  await rm(join(desktop, "b.md"))
  assert.equal((await sync(desktop, join(dir, "s-desktop"))).listing, "feed")
  const report = await sync(vm, join(dir, "s-vm"))
  assert.equal(report.listing, "feed")
  assert.deepEqual(report.pulled, ["a.md"])
  assert.deepEqual(report.removed, ["b.md"])
  assert.equal(await readFile(join(vm, "a.md"), "utf8"), "edited")
  assert.deepEqual((await readdir(vm)).sort(), ["a.md"])
})

test("the feed names only the asked folder, later records winning", async () => {
  let clock = Date.parse("2026-10-07T12:00:00Z")
  const now = () => clock
  const start = await read_changes(storage, `people/${phone}/x/`, "", { now })
  clock += 1000
  await record_change(storage, `people/${phone}/x/f.md`, "1", { now })
  clock += 1000
  await record_change(storage, `people/${phone}/y/g.md`, "1", { now })
  clock += 1000
  await record_change(storage, `people/${phone}/x/f.md`, null, { now })
  const feed = await read_changes(storage, `people/${phone}/x/`, start.cursor, { now })
  assert.deepEqual(feed.changes, { "f.md": null })
})

test("an expired cursor answers 410, and the client walks", async () => {
  const store = client({ url, token: issuer.token(phone) })
  assert.equal(await store.changes("can://~/harness/", "2020-01-01T00:00:00.000Z"), null)
  const old = await fetch(`${url}/people/${phone}/harness/?changes=2020-01-01T00:00:00.000Z`, { headers: { authorization: `Bearer ${issuer.token(phone)}` } })
  assert.equal(old.status, 410)
})

test("nobody reads the raw changes folder", async () => {
  const response = await fetch(`${url}/changes/${phone}/`, { headers: { authorization: `Bearer ${issuer.token(phone)}` } })
  assert.equal(response.status, 403)
})
