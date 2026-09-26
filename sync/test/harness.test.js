/**
 * `brayness sync`: plan Syncs sections against a real sync service on disk.
 */
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { disk } from "brayness-can-store/disk"
import { client } from "../src/client.js"
import { dev_issuer } from "../src/dev-token.js"
import { find_root, refused, sync_harness, syncs_of } from "../src/harness.js"
import { rights } from "../src/rights.js"
import { sync_service } from "../src/server.js"

const A = "+15555550100"
// Outside every git repo, or each path would be refused as inside one.
const root = new URL(`../../../../artifacts/brayness/harness-test-${randomUUID()}/`, import.meta.url).pathname
const issuer = dev_issuer()
let server
let store

before(async () => {
  const storage = disk(join(root, "bucket"))
  server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  store = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token(A) })
})
after(async () => {
  server.close()
  await rm(root, { recursive: true, force: true })
})

const files = async (dir, entries) => {
  for (const [path, body] of Object.entries(entries)) {
    await mkdir(join(dir, path, ".."), { recursive: true })
    await writeFile(join(dir, path), body)
  }
  return dir
}

test("a Syncs section lists paths until the next heading", () => {
  const plan = "# P\n\n- not this\n\n## Syncs\n\n- `work/thoughts`\n* artifacts/posters/\n\n## Decisions\n\n- not this\n"
  assert.deepEqual(syncs_of(plan), ["work/thoughts", "artifacts/posters/"])
  assert.deepEqual(syncs_of("# P\n\n### Syncs\n- deeper headings do not count\n"), [])
})

test("paths outside the harness or never synced are refused", () => {
  assert.equal(refused("/etc"), "absolute")
  assert.equal(refused("../elsewhere"), "outside the harness")
  assert.equal(refused("."), "outside the harness")
  assert.equal(refused("work/app/node_modules"), "never syncs")
  assert.equal(refused("work/thoughts/"), null)
})

test("the root is the nearest folder above holding plans/", async () => {
  const harness = await files(join(root, "find"), { "plans/p.md": "", "work/deep/x.md": "" })
  assert.equal(find_root(join(harness, "work/deep"), {}), harness)
  assert.equal(find_root("/", { BRAYNESS_ROOT: harness }), harness)
})

test("two harnesses share each plan's folders; repos are refused", async () => {
  const laptop = await files(join(root, "laptop"), {
    "plans/a.md": "# A\n\n## Syncs\n\n- `work/thoughts`\n- work/repo\n",
    "plans/b.md": "# B\n\n## Syncs\n\n- work/thoughts\n- ../escape\n",
    "work/thoughts/2026-09-27.md": "a thought",
    "work/repo/README.md": "code",
  })
  await promisify(execFile)("git", ["init", "-q", join(laptop, "work/repo")])
  const session = await files(join(root, "session"), { "plans/a.md": "# A\n\n## Syncs\n\n- work/thoughts\n" })

  const first = await sync_harness({ root: laptop, store })
  assert.deepEqual(Object.keys(first.synced), ["work/thoughts"])
  assert.deepEqual(first.synced["work/thoughts"].pushed, ["2026-09-27.md"])
  assert.deepEqual(first.refused, { "work/repo": "inside a git repo (a.md)", "../escape": "outside the harness (b.md)" })

  const pulled = await sync_harness({ root: session, store, plans: ["a"] })
  assert.deepEqual(pulled.synced["work/thoughts"].pulled, ["2026-09-27.md"])
  assert.equal(await readFile(join(session, "work/thoughts/2026-09-27.md"), "utf8"), "a thought")
  assert.deepEqual(Object.keys(await store.walk("can://~/work/")), ["thoughts/2026-09-27.md"], "the repo never uploads")
})
