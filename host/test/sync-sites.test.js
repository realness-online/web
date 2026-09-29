import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { disk } from "../../can-store/src/disk.js"
import { rights } from "../../sync/src/rights.js"
import { sync_service } from "../../sync/src/server.js"
import { SyncSites } from "../src/sync-sites.js"
import { issue_host_pass } from "../src/host-pass.js"

const dir = new URL(`../../dist/sync-sites-test-${randomUUID()}`, import.meta.url).pathname
const secret = "test-secret-123456789012345678901234567890"
const owner = "+15555550100"
const other = "+15555550101"
const id = "a-123456789abc"
let server, sites

before(async () => {
  await mkdir(join(dir, "tree"), { recursive: true })
  const storage = disk(join(dir, "storage"))
  server = sync_service({ storage, rights: rights(storage), project: "none", certs: async () => ({}), host_pass_secret: secret, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  sites = new SyncSites({ url: `http://127.0.0.1:${server.address().port}`, secret })
})
after(async () => { server.close(); await rm(dir, { recursive: true, force: true }) })

test("sync holds the published versions after the publishing host's tree goes away", async () => {
  const root = join(dir, "tree")
  const live = () => fetch(`${sites.url}/sites/${id}/`)
  await writeFile(join(root, "index.html"), "first")
  const first = await sites.publish(owner, id, root)
  assert.equal(first.files, 1)
  assert.equal(await (await live()).text(), "first")
  const source = `${sites.url}/people/${encodeURIComponent(owner)}/work/site/`
  const auth = { authorization: `Bearer ${issue_host_pass({ phone: owner }, secret)}` }
  assert.equal(await (await fetch(`${source}.brayness-site-id`, { headers: auth })).text(), `${id}\n`)
  await writeFile(join(root, "obsolete.css"), "old")
  await writeFile(join(root, "index.html"), "second")
  const second = await sites.publish(owner, id, root)
  assert.equal(await (await live()).text(), "second")
  await rm(join(root, "obsolete.css"))
  await sites.publish(owner, id, root)
  assert.equal((await fetch(`${source}obsolete.css`, { headers: auth })).status, 404)
  await rm(root, { recursive: true })
  assert.equal((await sites.versions(owner, id))[0].id, second.version)
  await assert.rejects(sites.restore(other, id, first.version), /403/)
  await sites.restore(owner, id, first.version)
  assert.equal(await (await live()).text(), "first")
  assert.equal((await sites.remove(owner, id)).version, first.version)
  assert.equal((await live()).status, 404)
  await sites.restore(owner, id, second.version)
  assert.equal(await (await live()).text(), "second")
})
