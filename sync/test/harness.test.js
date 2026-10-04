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
const RESTORE_OWNER = "+15555550102"
// Outside every git repo, or each path would be refused as inside one.
const root = new URL(`../../../../artifacts/brayness/harness-test-${randomUUID()}/`, import.meta.url).pathname
const issuer = dev_issuer()
let server
let store

before(async () => {
  process.env.BRAYNESS_STATE = join(root, "state")
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

test("a lost disk restores Pi conversation JSON from sync alone", async () => {
  const first = await files(join(root, "restore-first"), {
    ".ignore": "",
    "vault/plans/brayness.md": "# Brayness\n",
    ".pi/agent/sessions/--brayness--/call.jsonl": [
      JSON.stringify({ type: "session", version: 3, id: "00000000-0000-4000-8000-000000000001", timestamp: "2026-09-27T00:00:00.000Z", cwd: "/brayness" }),
      JSON.stringify({ type: "message", id: "abcdef12", parentId: null, timestamp: "2026-09-27T00:00:01.000Z", message: { role: "user", content: [{ type: "text", text: "remember this" }], timestamp: 1790467201000 } }),
    ].join("\n") + "\n",
    ".pi/agent/auth.json": "SECRET",
    ".pi/agent/memory.db": "derived index",
  })
  const recovery_store = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token(RESTORE_OWNER) })
  const original = await sync_harness({ root: first, store: recovery_store })
  assert.deepEqual(original.synced[".pi/agent/sessions"].pushed, ["--brayness--/call.jsonl"])
  await rm(first, { recursive: true, force: true })

  const fresh = await files(join(root, "restore-fresh"), {
    "vault/plans/brayness.md": "# Brayness\n",
  })
  const restored = await sync_harness({ root: fresh, store: recovery_store })
  assert.deepEqual(restored.harness.sessions.pulled, ["--brayness--/call.jsonl"])
  const session_file = join(fresh, ".pi/agent/sessions/--brayness--/call.jsonl")
  const entries = (await readFile(session_file, "utf8")).trimEnd().split("\n").map(JSON.parse)
  assert.equal(entries[0].type, "session")
  assert.equal(entries[1].message.content[0].text, "remember this")
  assert.equal(Object.hasOwn(restored.synced, "work/thoughts"), false)
  await assert.rejects(readFile(join(fresh, ".pi/agent/auth.json")), { code: "ENOENT" })
  await assert.rejects(readFile(join(fresh, ".pi/agent/memory.db")), { code: "ENOENT" })
})

test("v8: root discovery uses vault/plans, never an old plans folder", async () => {
  const harness = await files(join(root, "find"), { "vault/plans/p.md": "", "work/deep/x.md": "" })
  assert.equal(find_root(join(harness, "work/deep"), {}), harness)
  assert.equal(find_root("/", { BRAYNESS_ROOT: harness }), harness)
  const old = await files(join(root, "old-root"), { "plans/p.md": "", "work/deep/x.md": "" })
  assert.notEqual(find_root(join(old, "work/deep"), {}), old)
})

test("h1: root discovery and default sync work without plans", async () => {
  const harness = await files(join(root, "no-plans"), {
    ".ignore": "",
    "notes/deep/idea.md": "idea",
  })
  assert.equal(find_root(join(harness, "notes/deep"), {}), harness)
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550106") })
  const report = await sync_harness({ root: harness, store: owner })
  assert.ok(report.harness.files.pushed.includes("notes/deep/idea.md"))
  await assert.rejects(sync_harness({ root: harness, store: owner, plans: ["missing"] }), { code: "ENOENT" })
})

test("h1: Pi configuration identifies a harness without plans", async () => {
  const harness = await files(join(root, "pi-root"), { ".pi/agent/settings.json": "{}", "notes/deep/idea.md": "idea" })
  assert.equal(find_root(join(harness, "notes/deep"), {}), harness)
})

test("v8: default sync reads vault plans and ignores old plans", async () => {
  const harness = await files(join(root, "default-plans"), {
    "vault/plans/p.md": "# P\n\n## Syncs\n- notes\n",
    "plans/p.md": "# Old\n\n## Syncs\n- old-notes\n",
    "notes/a.md": "current",
    "old-notes/a.md": "old",
  })
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550118") })
  const report = await sync_harness({ root: harness, store: owner })
  assert.deepEqual(Object.keys(report.synced), [".pi/agent/sessions", "notes"])
  assert.equal((await owner.cat("can://~/notes/a.md")).toString(), "current")
  await assert.rejects(owner.cat("can://~/old-notes/a.md"), { status: 404 })
})

test("v5: sync reads plans from the package.json setting", async () => {
  const harness = await files(join(root, "configured-plans"), {
    "package.json": JSON.stringify({ brayness: { plans: "custom/plans" } }),
    "custom/plans/p.md": "# P\n\n## Syncs\n- notes\n",
    "notes/a.md": "configured plan",
  })
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550108") })
  assert.equal(find_root(join(harness, "notes"), {}), harness)
  const report = await sync_harness({ root: harness, store: owner, plans: ["p"] })
  assert.deepEqual(report.synced.notes.pushed, ["a.md"])
  assert.equal((await owner.cat("can://~/notes/a.md")).toString(), "configured plan")
})

test("two harnesses share each plan's folders; repos are refused", async () => {
  const laptop = await files(join(root, "laptop"), {
    ".ignore": "",
    "vault/plans/a.md": "# A\n\n## Syncs\n\n- `work/thoughts`\n- work/repo\n",
    "vault/plans/b.md": "# B\n\n## Syncs\n\n- work/thoughts\n- ../escape\n",
    "work/thoughts/2026-09-27.md": "a thought",
    "work/repo/README.md": "code",
  })
  await promisify(execFile)("git", ["init", "-q", join(laptop, "work/repo")])
  const session = await files(join(root, "session"), { "vault/plans/a.md": "# A\n\n## Syncs\n\n- work/thoughts\n" })

  const first = await sync_harness({ root: laptop, store })
  assert.deepEqual(Object.keys(first.synced), [".pi/agent/sessions", "work/thoughts"])
  assert.deepEqual(first.synced["work/thoughts"].pushed, ["2026-09-27.md"])
  assert.deepEqual(first.refused, { "work/repo": "inside a git repo (a.md)", "../escape": "outside the harness (b.md)" })

  const pulled = await sync_harness({ root: session, store, plans: ["a"] })
  assert.ok(pulled.harness.files.pulled.includes("work/thoughts/2026-09-27.md"))
  assert.equal(await readFile(join(session, "work/thoughts/2026-09-27.md"), "utf8"), "a thought")
  assert.deepEqual(Object.keys(await store.walk("can://~/work/")), ["thoughts/2026-09-27.md"], "the repo never uploads")
})

test("h1: a whole harness reaches a fresh VM, minus ignores, repos, and big files; edits return", async () => {
  const phone = "+15555550104"
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token(phone) })
  // A layout that follows no convention: no plans, no vault, no Syncs lists.
  const desktop = await files(join(root, "h1-desktop"), {
    ".ignore": "# mine\nrenders/\n*.mov\n!keep.mov\n",
    "AGENTS.local.md": "memory\n",
    ".pi/agent/settings.json": "{}\n",
    ".pi/agent/auth.json": "SECRET",
    ".pi/agent/memory.db": "derived index",
    "notes/inbox/idea.md": "idea\n",
    "renders/frame.png": "big render",
    "clip.mov": "movie",
    "keep.mov": "kept",
    "code/README.md": "repo",
    "node_modules/x/index.js": "dep",
  })
  await mkdir(join(desktop, "code/.git"), { recursive: true })
  await writeFile(join(desktop, "huge.bin"), Buffer.alloc(11 * 1024 * 1024))

  const first = await sync_harness({ root: desktop, store: owner, legacy: false })
  assert.deepEqual(first.harness.files.too_big, ["huge.bin"])
  assert.deepEqual(Object.keys(await owner.walk("can://~/harness/")).sort(), [
    ".ignore", ".pi/agent/settings.json", "AGENTS.local.md", "keep.mov", "notes/inbox/idea.md",
  ])

  const vm = await files(join(root, "h1-vm"), {})
  await sync_harness({ root: vm, store: owner, legacy: false })
  assert.equal(await readFile(join(vm, "AGENTS.local.md"), "utf8"), "memory\n")
  assert.equal(await readFile(join(vm, "notes/inbox/idea.md"), "utf8"), "idea\n")
  for (const path of [".pi/agent/auth.json", ".pi/agent/memory.db", "renders/frame.png", "clip.mov", "code/README.md", "huge.bin"])
    await assert.rejects(readFile(join(vm, path)), { code: "ENOENT" }, path)

  await writeFile(join(vm, "AGENTS.local.md"), "memory\nlearned in VM\n")
  await sync_harness({ root: vm, store: owner, legacy: false })
  const back = await sync_harness({ root: desktop, store: owner, legacy: false })
  assert.deepEqual(back.harness.files.pulled, ["AGENTS.local.md"])
  assert.equal(await readFile(join(desktop, "AGENTS.local.md"), "utf8"), "memory\nlearned in VM\n")
})

test("h1: personal ignores also apply to legacy plan-selected paths", async () => {
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550107") })
  const desktop = await files(join(root, "h1-legacy-ignores"), {
    ".ignore": "notes/private.md\nprivate/\nhidden.txt\n",
    "vault/plans/p.md": "# P\n\n## Syncs\n- notes\n- private\n- private.txt\n- hidden.txt\n",
    "notes/public.md": "public",
    "notes/private.md": "private",
    "private/a.md": "private",
    "private.txt": "public single file",
    "hidden.txt": "private single file",
  })
  await sync_harness({ root: desktop, store: owner })
  assert.equal((await owner.cat("can://~/notes/public.md")).toString(), "public")
  assert.equal((await owner.cat("can://~/private.txt")).toString(), "public single file")
  for (const path of ["notes/private.md", "private/a.md", "hidden.txt"])
    for (const base of ["can://~/", "can://~/harness/"])
      await assert.rejects(owner.cat(`${base}${path}`), { status: 404 })
})

test("h1: artifacts stay local on upload and restore, even when listed", async () => {
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550109") })
  const desktop = await files(join(root, "artifacts-desktop"), {
    ".ignore": "",
    "vault/plans/p.md": "# P\n\n## Syncs\n- artifacts\n- notes\n",
    "artifacts/preview.txt": "local preview",
    "notes/note.md": "saved note",
    "notes/artifacts/result.svg": "local result",
  })
  await sync_harness({ root: desktop, store: owner })
  for (const path of ["artifacts/preview.txt", "notes/artifacts/result.svg"])
    for (const base of ["can://~/", "can://~/harness/"])
      await assert.rejects(owner.cat(`${base}${path}`), { status: 404 })
  assert.equal(await readFile(join(desktop, "artifacts/preview.txt"), "utf8"), "local preview")
  // Files uploaded before this rule must not return to a fresh harness.
  await owner.put("can://~/harness/artifacts/old.txt", "old artifact")
  await owner.put("can://~/harness/notes/artifacts/old.txt", "old artifact")
  const fresh = await files(join(root, "artifacts-fresh"), {})
  await sync_harness({ root: fresh, store: owner })
  assert.equal(await readFile(join(fresh, "notes/note.md"), "utf8"), "saved note")
  await assert.rejects(readFile(join(fresh, "artifacts/old.txt")), { code: "ENOENT" })
  await assert.rejects(readFile(join(fresh, "notes/artifacts/old.txt")), { code: "ENOENT" })
})

for (const [index, folder] of [".obsidian", ".smart-env"].entries()) {
  test(`h2: ${folder} stays local on upload and restore, even when listed`, async () => {
    const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token(`+1555555011${index}`) })
    const desktop = await files(join(root, `${folder}-desktop`), {
      ".ignore": "",
      "vault/plans/p.md": `# P\n\n## Syncs\n- ${folder}\n- vault\n`,
      [`${folder}/config.json`]: "local config",
      [`vault/nested/${folder}/index.bin`]: "local index",
      "vault/note.md": "saved note",
    })
    await sync_harness({ root: desktop, store: owner })
    for (const path of [`${folder}/config.json`, `vault/nested/${folder}/index.bin`]) {
      for (const base of ["can://~/", "can://~/harness/"])
        await assert.rejects(owner.cat(`${base}${path}`), { status: 404 })
      assert.ok(await readFile(join(desktop, path)))
    }
    for (const path of [`${folder}/old.json`, `vault/nested/${folder}/old.bin`])
      await owner.put(`can://~/harness/${path}`, "old metadata")
    const fresh = await files(join(root, `${folder}-fresh`), {})
    await sync_harness({ root: fresh, store: owner })
    assert.equal(await readFile(join(fresh, "vault/note.md"), "utf8"), "saved note")
    for (const path of [`${folder}/old.json`, `vault/nested/${folder}/old.bin`])
      await assert.rejects(readFile(join(fresh, path)), { code: "ENOENT" })
  })
}

test("h1: without a .ignore, only listed folders and history sync", async () => {
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550105") })
  const desktop = await files(join(root, "h1-unreviewed"), {
    "vault/plans/p.md": "# P\n\n## Syncs\n\n- notes\n",
    "notes/a.md": "listed",
    "artifacts/big.bin": "not reviewed",
  })
  const report = await sync_harness({ root: desktop, store: owner })
  assert.equal(report.harness, null)
  assert.deepEqual(report.synced.notes.pushed, ["a.md"])
  await assert.rejects(owner.walk("can://~/harness/").then((found) => { if (!Object.keys(found).length) throw Object.assign(new Error("empty"), { status: 404 }) }), { status: 404 })
  await assert.rejects(owner.cat("can://~/artifacts/big.bin"), { status: 404 })
})

test("turn-end defers a saved-history edit and pushes a write", async () => {
  const { DatabaseSync } = await import("node:sqlite")
  const { createHash } = await import("node:crypto")
  const hash = (text) => createHash("sha256").update(text).digest("hex")
  const actor = await files(join(root, "defer"), {
    "vault/plans/p.md": "# P\n\n## Syncs\n\n- work/notes\n",
    "work/notes/doc.md": "title\nbody\n",
    "work/notes/raw.md": "one\n",
  })
  const owner = client({ url: `http://127.0.0.1:${server.address().port}`, token: issuer.token("+15555550103") })
  await sync_harness({ root: actor, store: owner })

  const session = join(actor, ".pi/agent/sessions/s.jsonl")
  const call = { type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "c1", name: "edit", arguments: { path: "doc.md", edits: [{ oldText: "body", newText: "BODY" }] } }] } }
  await files(actor, { ".pi/agent/sessions/s.jsonl": JSON.stringify(call) + "\n", "work/notes/doc.md": "title\nBODY\n", "work/notes/raw.md": "two\n" })
  const db = new DatabaseSync(join(root, "state", "edits.db"))
  db.exec("CREATE TABLE IF NOT EXISTS edit (id INTEGER PRIMARY KEY, path TEXT, sha TEXT, session TEXT, turn INTEGER, tool TEXT, tool_call TEXT, ts TEXT)")
  const later = new Date(Date.now() + 1000).toISOString()
  db.prepare("INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, ?, ?, 1, ?, ?, ?)").run(join(actor, "work/notes/doc.md"), hash("title\nBODY\n"), session, "edit", "c1", later)
  db.prepare("INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, ?, ?, 1, ?, '', ?)").run(join(actor, "work/notes/raw.md"), hash("two\n"), session, "write", later)
  db.close()

  const report = await sync_harness({ root: actor, store: owner, defer_edits: true })
  assert.deepEqual(report.synced[".pi/agent/sessions"].pushed, ["s.jsonl"], "history is saved first")
  assert.deepEqual(report.synced["work/notes"].deferred, ["doc.md"])
  assert.deepEqual(report.synced["work/notes"].pushed, ["raw.md"], "a write cannot be replayed")
  assert.equal((await owner.cat("can://~/work/notes/doc.md")).toString(), "title\nbody\n")
  assert.deepEqual(Object.keys(JSON.parse(await owner.cat("can://~/.pi/agent/deferred.json"))), ["work/notes/doc.md"])

  // The actor is lost; a fresh one rebuilds the edit from saved history.
  const fresh = await files(join(root, "defer-fresh"), { "vault/plans/p.md": "# P\n\n## Syncs\n\n- work/notes\n" })
  const pulled = await sync_harness({ root: fresh, store: owner })
  assert.deepEqual(pulled.applied, ["work/notes/doc.md"])
  assert.equal(await readFile(join(fresh, "work/notes/doc.md"), "utf8"), "title\nBODY\n")
  assert.equal(await readFile(join(fresh, "work/notes/raw.md"), "utf8"), "two\n")

  // A plain sync still carries the bytes.
  const plain = await sync_harness({ root: actor, store: owner })
  assert.deepEqual(plain.synced["work/notes"].pushed, ["doc.md"])
  assert.equal((await owner.cat("can://~/work/notes/doc.md")).toString(), "title\nBODY\n")
  assert.deepEqual(JSON.parse(await owner.cat("can://~/.pi/agent/deferred.json")), {}, "pushed bytes clear the pending edit")
})

test("s1f: a crash at any upload loses only work after the last completed sync", async () => {
  const { DatabaseSync } = await import("node:sqlite")
  const { createHash } = await import("node:crypto")
  const hash = (text) => createHash("sha256").update(text).digest("hex")
  const url = `http://127.0.0.1:${server.address().port}`
  const plan = { "vault/plans/p.md": "# P\n\n## Syncs\n\n- work/notes\n" }
  let completed = 0
  for (let crash_at = 0; ; crash_at++) {
    const phone = `+1555555${String(1000 + crash_at).padStart(4, "0")}`
    const store = client({ url, token: issuer.token(phone) })
    const actor = await files(join(root, `s1f-${crash_at}`), { ...plan, "work/notes/doc.md": "title\nbody\n", "work/notes/raw.md": "one\n" })
    await sync_harness({ root: actor, store })

    // One turn: an edit that can be deferred, and a write that cannot.
    const session = join(actor, ".pi/agent/sessions/s.jsonl")
    const call = { type: "message", message: { role: "assistant", content: [{ type: "toolCall", id: "c1", name: "edit", arguments: { path: "doc.md", edits: [{ oldText: "body", newText: "BODY" }] } }] } }
    await files(actor, { ".pi/agent/sessions/s.jsonl": `${JSON.stringify(call)}\n`, "work/notes/doc.md": "title\nBODY\n", "work/notes/raw.md": "two\n" })
    const db = new DatabaseSync(join(root, "state", "edits.db"))
    db.exec("CREATE TABLE IF NOT EXISTS edit (id INTEGER PRIMARY KEY, path TEXT, sha TEXT, session TEXT, turn INTEGER, tool TEXT, tool_call TEXT, ts TEXT)")
    const later = new Date(Date.now() + 1000).toISOString()
    const log = db.prepare("INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, ?, ?, 1, ?, ?, ?)")
    log.run(join(actor, "work/notes/doc.md"), hash("title\nBODY\n"), session, "edit", "c1", later)
    log.run(join(actor, "work/notes/raw.md"), hash("two\n"), session, "write", "", later)
    db.close()

    // The turn-end sync dies before its (crash_at + 1)th upload.
    let puts = 0
    const dying = client({ url, token: issuer.token(phone), fetcher: (target, init) => {
      if (init?.method === "PUT" && puts++ === crash_at) throw new Error("crash")
      return fetch(target, init)
    } })
    const crashed = await sync_harness({ root: actor, store: dying, defer_edits: true }).then(() => false, () => true)

    const fresh = await files(join(root, `s1f-${crash_at}-fresh`), plan)
    await sync_harness({ root: fresh, store })
    const doc = await readFile(join(fresh, "work/notes/doc.md"), "utf8")
    const raw = await readFile(join(fresh, "work/notes/raw.md"), "utf8")
    assert.ok(["title\nbody\n", "title\nBODY\n"].includes(doc), `crash ${crash_at}: doc is old or new, never a third thing`)
    assert.ok(["one\n", "two\n"].includes(raw), `crash ${crash_at}: raw is old or new`)
    if (!crashed) {
      assert.equal(doc, "title\nBODY\n", "a completed sync loses nothing")
      assert.equal(raw, "two\n")
      completed = crash_at
      break
    }
    assert.ok(crash_at < 10, "the turn-end sync makes only a few uploads")
  }
  assert.ok(completed >= 3, "history, the write, and the pending list each upload")
})
