// h4: a light VM against a real sync service on disk - recover, sync, fetch.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, utimes } from "node:fs/promises"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { disk } from "#root/lib/can/src/disk.js"
import { rights } from "#root/server/sync/src/rights.js"
import { issue_harness_pass, issue_recovery_pass } from "#root/lib/sign-on/src/node/recovery-pass.js"
import { actor_client, sync_actor } from "#root/lib/harness/src/actor.js"
import { fetch_skipped, light_policy, light_skips, read_skipped } from "#root/lib/harness/src/light.js"
import { sync_service } from "#root/server/sync/src/server.js"
import { recover } from "#root/lib/harness/src/recover.js"

const secret = "light-test-secret-at-least-thirty-two-bytes!"
const phone = "+14155550125"
const id = "a-11a700000001"
const dir = new URL(`../../../../../artifacts/brayness/light-${randomUUID()}/`, import.meta.url).pathname
const DAY = 24 * 60 * 60 * 1000
const OLD = ".pi/agent/sessions/--brayness--/old.jsonl"
const NEW = ".pi/agent/sessions/--brayness--/new.jsonl"
const BIG = "work/big.bin"
let storage, server, url

before(async () => {
  storage = disk(join(dir, "bucket"))
  const put = (path, body) => storage.put(`people/${phone}/harness/${path}`, body)
  await put(".ignore", "")
  await put("package.json", JSON.stringify({ brayness: { light: { days: 14, bytes: 1000 } } }))
  await put("vault/plans/p.md", "# Plan\n")
  await put(NEW, '{"type":"session"}\n')
  await put(OLD, '{"type":"session","old":true}\n')
  await put(BIG, "x".repeat(2000))
  const month_ago = new Date(Date.now() - 30 * DAY)
  await utimes(join(dir, "bucket", `people/${phone}/harness/${OLD}`), month_ago, month_ago)
  server = sync_service({ storage, rights: rights(storage), project: "none", certs: async () => ({}), host_pass_secret: secret, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
  await rm(dir, { recursive: true, force: true })
  delete process.env.BRAYNESS_STATE
})

test("light policy: unset is full; true takes defaults; bad numbers refuse", () => {
  assert.equal(light_policy(JSON.stringify({ brayness: {} })), null)
  assert.equal(light_policy(null), null)
  assert.deepEqual(light_policy(JSON.stringify({ brayness: { light: true } })), { days: 14, bytes: 2 * 1024 * 1024 })
  assert.throws(() => light_policy(JSON.stringify({ brayness: { light: { days: 0 } } })), /days/)
})

test("light skips: big files anywhere, old files only in session history", () => {
  const now = Date.parse("2026-10-07T00:00:00Z")
  const listing = {
    [OLD]: { size: 10, updated: "2026-09-01T00:00:00Z" },
    [NEW]: { size: 10, updated: "2026-10-06T00:00:00Z" },
    "vault/plans/old-plan.md": { size: 10, updated: "2025-01-01T00:00:00Z" },
    [BIG]: { size: 5000, updated: "2026-10-06T00:00:00Z" },
  }
  assert.deepEqual(light_skips(listing, { days: 14, bytes: 1000 }, now), [OLD, BIG])
})

test("a light VM leaves old history and big files in storage, keeps them through sync, and fetches on demand", async () => {
  const root = join(dir, "vm")
  const state = join(root, ".pi/agent/state")
  await mkdir(root, { recursive: true })
  process.env.BRAYNESS_STATE = state

  const recovered = await recover(url, () => issue_recovery_pass({ phone, id }, secret), root, { state, starter: null })
  assert.deepEqual(recovered.light, { skipped: 2 })
  assert.equal(await readFile(join(root, NEW), "utf8"), '{"type":"session"}\n')
  assert.equal(await readFile(join(root, "vault/plans/p.md"), "utf8"), "# Plan\n")
  for (const path of [OLD, BIG]) await assert.rejects(readFile(join(root, path)), { code: "ENOENT" })
  assert.deepEqual([...read_skipped(state)], [OLD, BIG].sort())

  // The VM's own sync neither pulls the skipped files nor deletes them from storage.
  const issue = async () => issue_harness_pass({ phone, id }, secret)
  const first = await sync_actor({ url, root, issue, state })
  assert.deepEqual([...first.harness.files.conflicts, ...first.harness.sessions.conflicts], [])
  for (const path of [OLD, BIG]) {
    await assert.rejects(readFile(join(root, path)), { code: "ENOENT" })
    assert.ok(await storage.get(`people/${phone}/harness/${path}`), `${path} stays in storage`)
  }

  // Reading one fetches it, and it stops being skipped.
  const { store } = await actor_client({ url, issue })
  assert.deepEqual(await fetch_skipped({ root, state, store, path: OLD }), { path: OLD, fetched: true })
  assert.equal(await readFile(join(root, OLD), "utf8"), '{"type":"session","old":true}\n')
  assert.deepEqual([...read_skipped(state)], [BIG])
  assert.deepEqual(await fetch_skipped({ root, state, store, path: OLD }), { path: OLD, fetched: false })

  // The next sync adopts the fetched file without a conflict or a second copy.
  const second = await sync_actor({ url, root, issue, state })
  assert.deepEqual([...second.harness.files.conflicts, ...second.harness.sessions.conflicts, ...second.harness.sessions.kept_both], [])
  assert.equal((await storage.get(`people/${phone}/harness/${OLD}`)).body.toString(), '{"type":"session","old":true}\n')
})
