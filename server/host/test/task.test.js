// o0: a task VM against a real sync service on disk - limited to its plan's paths.
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { after, before, test } from "node:test"
import { disk } from "#root/lib/can/src/disk.js"
import { client } from "#root/lib/files/src/client.js"
import { rights } from "#root/server/sync/src/rights.js"
import { issue_harness_pass, issue_recovery_pass } from "#root/lib/sign-on/src/node/recovery-pass.js"
import { sync_actor } from "#root/lib/harness/src/actor.js"
import { TASK_BASICS, task_paths } from "#root/lib/harness/src/task.js"
import { sync_service } from "#root/server/sync/src/server.js"
import { recover } from "#root/lib/harness/src/recover.js"

const secret = "task-test-secret-at-least-thirty-two-bytes!"
const phone = "+14155550128"
const id = "a-7a5c00000001"
const dir = new URL(`../../../../../artifacts/brayness/task-${randomUUID()}/`, import.meta.url).pathname
let storage, server, url

const PLAN = "# Brayness\n\n## Nodes\n\n| a |\n\n## Syncs\n\n- work/demo\n- `bin/`\n\n## Notes\n\n- x\n"

before(async () => {
  storage = disk(join(dir, "bucket"))
  const put = (path, body) => storage.put(`people/${phone}/harness/${path}`, body)
  await put(".ignore", "")
  await put("package.json", JSON.stringify({ brayness: { plans: "vault/Projects" } }))
  await put("AGENTS.md", "guidance\n")
  await put("vault/Projects/brayness.md", PLAN)
  await put("work/demo/a.js", "one\n")
  await put("work/other/private.md", "another plan's folder\n")
  await put("vault/Areas/diary.md", "personal\n")
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

test("a task's paths are its plan's Syncs, the plans folder, and the basics", async () => {
  const root = join(dir, "desktop")
  await mkdir(join(root, "vault/Projects"), { recursive: true })
  await writeFile(join(root, "package.json"), JSON.stringify({ brayness: { plans: "vault/Projects" } }))
  await writeFile(join(root, "vault/Projects/brayness.md"), PLAN)
  await writeFile(join(root, "vault/Projects/empty.md"), "# Empty\n\n## Nodes\n")
  await writeFile(join(root, "vault/Projects/bad.md"), "# Bad\n\n## Syncs\n\n- ../outside\n- .env\n")
  assert.deepEqual(await task_paths(root, "brayness"), ["work/demo", "bin", "vault/Projects", ...TASK_BASICS])
  await assert.rejects(task_paths(root, "empty"), /no ## Syncs/)
  await assert.rejects(task_paths(root, "bad"), /cannot include: \.\.\/outside, \.env/)
  await assert.rejects(task_paths(root, "../secrets"), /file name/)
  await assert.rejects(task_paths(root, "missing"), /no plan missing\.md/)
})

test("a task VM gets only its paths, writes files and folders there, and cannot reach past them", async () => {
  const root = join(dir, "vm")
  const state = join(root, ".pi/agent/state")
  await mkdir(root, { recursive: true })
  process.env.BRAYNESS_STATE = state
  const paths = ["work/demo", "vault/Projects", "AGENTS.md", ".ignore"]

  await recover(url, () => issue_recovery_pass({ phone, id, paths }, secret), root, { state, starter: null })
  assert.equal(await readFile(join(root, "work/demo/a.js"), "utf8"), "one\n")
  assert.equal(await readFile(join(root, "AGENTS.md"), "utf8"), "guidance\n")
  for (const path of ["work/other/private.md", "vault/Areas/diary.md"]) await assert.rejects(readFile(join(root, path)), { code: "ENOENT" })

  // Edits inside the limits travel, a single file included; one outside stays home.
  await writeFile(join(root, "work/demo/a.js"), "two\n")
  await writeFile(join(root, "AGENTS.md"), "guidance, edited\n")
  await mkdir(join(root, "vault/Areas"), { recursive: true })
  await writeFile(join(root, "vault/Areas/diary.md"), "overwrite attempt\n")
  const issue = async () => issue_harness_pass({ phone, id, paths }, secret)
  const reports = await sync_actor({ url, root, issue, state })
  assert.deepEqual(Object.values(reports).flatMap((report) => report.conflicts), [])
  const stored = async (path) => (await storage.get(`people/${phone}/harness/${path}`)).body.toString()
  assert.equal(await stored("work/demo/a.js"), "two\n")
  assert.equal(await stored("AGENTS.md"), "guidance, edited\n")
  assert.equal(await stored("vault/Areas/diary.md"), "personal\n")

  // A second sync settles: nothing left to push, nothing kept twice.
  const again = await sync_actor({ url, root, issue, state })
  for (const report of Object.values(again)) assert.deepEqual([...report.pushed, ...report.kept_both, ...report.conflicts], [])

  // Sync itself refuses what the pass does not cover, even asked directly.
  const store = client({ url, token: issue_harness_pass({ phone, id, paths }, secret), phone })
  await assert.rejects(store.put("can://~/harness/vault/Areas/diary.md", "x"), { status: 403 })
  await assert.rejects(store.cat("can://~/harness/work/other/private.md"), { status: 403 })
  await assert.rejects(store.walk("can://~/harness/"), { status: 403 })
})
