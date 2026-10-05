// The in-actor pull script against a real sync service on disk.
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { disk } from "../../can-store/src/disk.js"
import { rights } from "../../sync/src/rights.js"
import { issue_recovery_pass } from "../../sync/src/recovery-pass.js"
import { sync_service } from "../../sync/src/server.js"
import { recover } from "../../sync/src/recover.js"

const secret = "recover-test-secret-at-least-thirty-two-bytes"
const phone = "+14155550123"
const id = "a-abcdef123456"
const whole_phone = "+14155550124"
const dir = new URL(`../../../../artifacts/brayness/recover-${randomUUID()}/`, import.meta.url).pathname
const hash = (text) => createHash("sha256").update(text).digest("hex")
let storage, server, url

before(async () => {
  storage = disk(join(dir, "bucket"))
  const put = (path, body) => storage.put(`people/${phone}/${path}`, body)
  const call = { type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "c1", name: "edit", arguments: { path: "doc.md", edits: [{ oldText: "body", newText: "BODY" }] } }] } }
  await put(".pi/agent/sessions/s.jsonl", `${JSON.stringify(call)}\n`)
  await put("vault/plans/p.md", "# P\n\n## Syncs\n\n- work/notes\n- artifacts\n- .obsidian\n- .smart-env\n")
  await put("plans/p.md", "# Old\n\n## Syncs\n\n- work/other\n")
  await put("artifacts/preview.txt", "old artifact")
  await put("work/notes/artifacts/result.svg", "old nested artifact")
  for (const folder of [".obsidian", ".smart-env"]) {
    await put(`${folder}/config.json`, "old config")
    await put(`work/notes/nested/${folder}/index.bin`, "old index")
  }
  await put("custom/plans/p.md", "# P\n\n## Syncs\n\n- work/configured\n")
  await put("work/configured/note.md", "configured plans")
  await put("work/notes/doc.md", "title\nbody\n")
  await put("work/other/skip.md", "not declared")
  await put("vault/limited.md", "only for a limited actor")
  await put("vault/95% Of Your Problems.md", "percentage note")
  await put(".pi/agent/deferred.json", JSON.stringify({
    "work/notes/doc.md": { base_sha: hash("title\nbody\n"), target_sha: hash("title\nBODY\n"), calls: [{ session: "s.jsonl", tool_call: "c1" }] },
  }))
  await storage.put(`people/${whole_phone}/harness/.ignore`, "")
  await storage.put(`people/${whole_phone}/harness/package.json`, JSON.stringify({ brayness: { plans: "vault/plans" } }))
  await storage.put(`people/${whole_phone}/harness/vault/plans/p.md`, "# Whole\n")
  await storage.put(`people/${whole_phone}/harness/vault/95% Of Your Problems.md`, "actual note")
  await storage.put(`people/${whole_phone}/harness/vault/.obsidian/config.json`, "local only")
  await storage.put(`people/${whole_phone}/harness/vault/.smart-env/index.bin`, "local only")
  await storage.put(`people/${whole_phone}/harness/artifacts/preview.txt`, "local only")
  server = sync_service({ storage, rights: rights(storage), project: "none", certs: async () => ({}), host_pass_secret: secret, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
  await rm(dir, { recursive: true, force: true })
})

// Exercise the shared client, including a pass expiring on the first request.
const run = async (root, passes) => {
  await mkdir(root, { recursive: true })
  return recover(url, () => passes.shift(), root)
}

test("a fresh actor pulls saved files and replays pending edits", async () => {
  const root = join(dir, "full")
  const [count, applied] = await run(root, [issue_recovery_pass({ phone, id }, secret)])
  assert.equal(count, 3)
  assert.deepEqual(applied, ["work/notes/doc.md"])
  assert.equal(await readFile(join(root, "work/notes/doc.md"), "utf8"), "title\nBODY\n")
  await assert.rejects(readFile(join(root, "work/other/skip.md")), { code: "ENOENT" })
  await assert.rejects(readFile(join(root, "artifacts/preview.txt")), { code: "ENOENT" })
  await assert.rejects(readFile(join(root, "work/notes/artifacts/result.svg")), { code: "ENOENT" })
  for (const folder of [".obsidian", ".smart-env"]) {
    await assert.rejects(readFile(join(root, folder, "config.json")), { code: "ENOENT" })
    await assert.rejects(readFile(join(root, "work/notes/nested", folder, "index.bin")), { code: "ENOENT" })
  }
})

test("v5: recovery uses the plans folder from package.json", async () => {
  const root = join(dir, "configured")
  await mkdir(root, { recursive: true })
  await writeFile(join(root, "package.json"), JSON.stringify({ brayness: { plans: "custom/plans" } }))
  const [count, applied] = await run(root, [issue_recovery_pass({ phone, id }, secret)])
  assert.equal(count, 3)
  assert.deepEqual(applied, [])
  assert.equal(await readFile(join(root, "work/configured/note.md"), "utf8"), "configured plans")
  await assert.rejects(readFile(join(root, "vault/plans/p.md")), { code: "ENOENT" })
})

test("v7: whole-harness recovery restores vault paths and plain percentages", async () => {
  const root = join(dir, "whole")
  const [count, applied] = await run(root, [issue_recovery_pass({ phone: whole_phone, id }, secret)])
  assert.equal(count, 4)
  assert.deepEqual(applied, [])
  assert.equal(await readFile(join(root, "vault/95% Of Your Problems.md"), "utf8"), "actual note")
  assert.equal(await readFile(join(root, "vault/plans/p.md"), "utf8"), "# Whole\n")
  for (const path of ["vault/.obsidian/config.json", "vault/.smart-env/index.bin", "artifacts/preview.txt"])
    await assert.rejects(readFile(join(root, path)), { code: "ENOENT" })
})

test("v7: a limited actor restores a percentage filename", async () => {
  const root = join(dir, "percentage")
  const path = "vault/95% Of Your Problems.md"
  const [count] = await run(root, [issue_recovery_pass({ phone, id, paths: [path] }, secret)])
  assert.equal(count, 1)
  assert.equal(await readFile(join(root, path), "utf8"), "percentage note")
})

test("starter updates preserve a managed file's pending session edits", async () => {
  const phone = '+14155550125'
  const root = join(dir, 'starter-pending')
  const directory = join(dir, 'starter-distribution')
  const original = 'title\nbody\n'
  const target = 'title\nBODY\n'
  const latest = 'new title\nbody\n'
  const old_manifest = { version: hash('old starter'), files: { 'skill.md': hash(original) } }
  const next_manifest = { version: hash('new starter'), files: { 'skill.md': hash(latest) } }
  await mkdir(directory, { recursive: true })
  await mkdir(root, { recursive: true })
  await writeFile(join(directory, 'starter.json'), JSON.stringify(next_manifest))
  await writeFile(join(directory, 'skill.md'), latest)
  await writeFile(join(root, 'skill.md'), latest)
  const put = (path, body) => storage.put(`people/${phone}/harness/${path}`, body)
  await put('.ignore', '')
  await put('starter.json', JSON.stringify(old_manifest))
  await put('skill.md', original)
  const call = { message: { content: [{ type: 'toolCall', name: 'edit', id: 'pending', arguments: { edits: [{ oldText: 'body', newText: 'BODY' }] } }] } }
  await put('.pi/agent/sessions/s.jsonl', JSON.stringify(call) + '\n')
  await put('.pi/agent/deferred.json', JSON.stringify({
    'skill.md': { base_sha: hash(original), target_sha: hash(target), calls: [{ session: 's.jsonl', tool_call: 'pending' }] },
  }))
  const [, applied] = await recover(url, () => issue_recovery_pass({ phone, id }, secret), root, { starter: directory })
  assert.deepEqual(applied, ['skill.md'])
  assert.equal(await readFile(join(root, 'skill.md'), 'utf8'), target)
})

test("an expired pass renews once", async () => {
  const expired = issue_recovery_pass({ phone, id }, secret, Date.now() - 600_000)
  const [count] = await run(join(dir, "renew"), [expired, issue_recovery_pass({ phone, id }, secret)])
  assert.equal(count, 3)
})

test("a limited actor pulls only its paths", async () => {
  const root = join(dir, "limited")
  const [count, applied] = await run(root, [issue_recovery_pass({ phone, id, paths: ["vault/limited.md"] }, secret)])
  assert.equal(count, 1)
  assert.deepEqual(applied, [])
  assert.equal(await readFile(join(root, "vault/limited.md"), "utf8"), "only for a limited actor")
  await assert.rejects(readFile(join(root, ".pi/agent/sessions/s.jsonl")), { code: "ENOENT" })
})
