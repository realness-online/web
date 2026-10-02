import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { disk } from "../../can-store/src/disk.js"
import { dev_issuer } from "../../sync/src/dev-token.js"
import { rights } from "../../sync/src/rights.js"
import { sync_service } from "../../sync/src/server.js"
import { host_status, format_status } from "../src/status.js"

const dir = new URL(`../../dist/control-status-test-${randomUUID()}`, import.meta.url).pathname
const issuer = dev_issuer()
const storage = disk(dir)
const phone = "+15555550100"
let server, url

before(async () => {
  await mkdir(dir, { recursive: true })
  await storage.put("admins.html", `<a href="tel:${phone}">Admin</a>`)
  await storage.put("hosts/brayness-1/status.html", `<article itemscope itemtype="/host"><meta itemprop="name" content="brayness-1"><meta itemprop="seed" content="ready"><meta itemprop="checked" content="2026-09-30T12:00:00.000Z"><meta itemprop="actors_running" content="1"></article>\n<article itemscope itemtype="/actor"><meta itemprop="id" content="a-0123456789ab"><meta itemprop="owner" content="${phone}"></article>\n`)
  server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

test("operator lists status through sync and sees a stopped host's last report", async () => {
  const rows = await host_status("dev", null, { url, token: async () => issuer.token(phone), now: Date.parse("2026-09-30T12:01:00Z") })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].age_s, 60)
  assert.equal(rows[0].actors[0].owner, "+1***00")
  assert.equal(JSON.stringify(rows).includes(phone), false)
  assert.match(format_status(rows), /brayness-1: seed ready, 1 running, 1 actors, last seen 60s ago/)
})

test("non-admin cannot read host status", async () => {
  await assert.rejects(host_status("dev", null, { url, token: async () => issuer.token("+15555550101") }), /403/)
})
