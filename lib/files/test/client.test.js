/**
 * The gsutil-style client against a real sync service on disk.
 */
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { createHash, randomUUID } from "node:crypto"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { disk } from "#root/lib/can/src/disk.js"
import { client, conflict_name } from "#root/lib/files/src/client.js"
import { dev_issuer } from "#root/server/sync/src/dev-token.js"
import { rights } from "#root/server/sync/src/rights.js"
import { sync_service } from "#root/server/sync/src/server.js"
import { out_path } from "#root/lib/output.js"

const A = "+15555550100"
const B = "+15555550101"
const root = out_path(`client-test-${randomUUID()}/`)
const issuer = dev_issuer()
const storage = disk(join(root, "bucket"))
let server
let url

before(async () => {
  process.env.BRAYNESS_STATE = join(root, "state")
  process.env.BRAYNESS_TRASH = join(root, "trash")
  server = sync_service({ storage, rights: rights(storage), project: issuer.project, certs: issuer.certs, log: () => {} })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.close()
  await rm(root, { recursive: true, force: true })
})

const as = (phone) => client({ url, token: issuer.token(phone) })
const local = async (name, files) => {
  const dir = join(root, name)
  for (const [path, body] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true })
    await writeFile(join(dir, path), body)
  }
  return dir
}

test("can://~ names the token's own folder", () => {
  assert.equal(as(A).key("can://~/vault/x.md"), `people/${A}/vault/x.md`)
  assert.equal(as(A).key("can://~"), `people/${A}`)
  assert.throws(() => client({ url: "x" }).key("can://~/x"), /needs a token/)
})

test("cp up, ls, cat, cp down, rm", async () => {
  const a = as(A)
  const dir = await local("cp", { "note.md": "hello" })
  assert.equal(await a.cp(join(dir, "note.md"), "can://~/vault/"), "can://~/vault/note.md")
  assert.deepEqual(await a.ls("can://~/vault"), ["note.md"])
  assert.equal((await a.cat("can://~/vault/note.md")).toString(), "hello")
  const down = await a.cp("can://~/vault/note.md", join(dir, "down") + "/")
  assert.equal(await readFile(down, "utf8"), "hello")
  await a.rm("can://~/vault/note.md")
  assert.deepEqual(await a.ls("can://~/vault/"), [])
})

test("another person is refused, with the status", async () => {
  await as(A).put("can://~/vault/secret.md", "mine")
  await assert.rejects(as(B).cat(`can://people/${A}/vault/secret.md`), { status: 403 })
  await assert.rejects(client({ url }).ls(`can://people/${A}/vault/`), { status: 403 })
})

test("sync pushes, then skips what has not changed", async () => {
  const a = as(A)
  const dir = await local("plans", { "a.md": "a", "sub/b.md": "b", ".DS_Store": "junk", ".git/HEAD": "ref" })
  assert.deepEqual((await a.sync(dir, "can://~/plans/")).pushed, ["a.md", "sub/b.md"])
  const second = await a.sync(dir, "can://~/plans/")
  assert.deepEqual(second.unchanged, ["a.md", "sub/b.md"])
  assert.deepEqual(second.pushed, [])
  await writeFile(join(dir, "a.md"), "a, edited")
  assert.deepEqual((await a.sync(dir, "can://~/plans/")).pushed, ["a.md"])
  assert.deepEqual(await a.ls("can://~/plans/"), ["sub/", "a.md"])
})

test("names with spaces and dashes travel", async () => {
  const a = as(A)
  const dir = await local("names", { "02-08 Sunday — flow/notes.md": "n", "a#b?c.md": "q" })
  assert.deepEqual((await a.sync(dir, "can://~/names/")).pushed, ["02-08 Sunday — flow/notes.md", "a#b?c.md"])
  assert.equal((await a.cat("can://~/names/a#b?c.md")).toString(), "q")
  assert.deepEqual(Object.keys(await a.walk("can://~/names/")).sort(), ["02-08 Sunday — flow/notes.md", "a#b?c.md"])
})

test("downloads obey the never-sync list", async () => {
  const a = as(A)
  await a.put("can://~/pull-skip/.env", "SECRET=1")
  await a.put("can://~/pull-skip/app/node_modules/x.js", "x")
  await a.put("can://~/pull-skip/note.md", "n")
  const dir = await local("pull-skip", {})
  const report = await a.sync(dir, "can://~/pull-skip/")
  assert.deepEqual(report.pulled, ["note.md"])
  assert.deepEqual(await readdir(dir), ["note.md"])
})

test("read-only recovery never uploads local files, deletes, or sync records", async () => {
  const owner = as(A)
  await owner.put("can://~/read-only/saved.md", "saved")
  const dir = await local("read-only", { "local.md": "local", "saved.md": "starter" })
  const state = join(root, "read-only-state")
  const methods = []
  const reader = client({ url, token: issuer.token(A), fetcher: (url, options) => {
    methods.push(options.method)
    return fetch(url, options)
  } })
  const report = await reader.sync(dir, "can://~/read-only/", { pull_only: true, state })
  assert.deepEqual(report.pulled, ["saved.md"])
  assert.equal(await readFile(join(dir, "saved.md"), "utf8"), "saved")
  assert.equal(await readFile(join(dir, "local.md"), "utf8"), "local")
  assert.ok(methods.every(method => method === "GET"))
  await assert.rejects(readdir(state), { code: "ENOENT" })
  await assert.rejects(owner.cat("can://~/read-only/local.md"), { status: 404 })
})

test("recovery refuses symlink targets and remote traversal", async () => {
  const owner = as(A)
  await owner.put("can://~/linked/nested/note.md", "remote")
  const dir = await local("linked", { "local.md": "local" })
  const outside = await local("outside", { "note.md": "keep" })
  await symlink(outside, join(dir, "nested"))
  await assert.rejects(owner.sync(dir, "can://~/linked/", { pull_only: true }), /target is a link/)
  assert.equal(await readFile(join(outside, "note.md"), "utf8"), "keep")
  await assert.rejects(owner.sync(dir, "can://~/linked/", {
    pull_only: true, remote_files: { "../escape.md": "version" },
  }), /unsafe sync path|403/)
})

test("edits travel both ways between two folders", async () => {
  const a = as(A)
  const laptop = await local("two/laptop", { "note.md": "one", "img.bin": Buffer.from([0, 1, 2]) })
  const session = await local("two/session", {})
  await a.sync(laptop, "can://~/two/")
  assert.deepEqual((await a.sync(session, "can://~/two/")).pulled, ["img.bin", "note.md"])
  await writeFile(join(session, "note.md"), "two")
  await a.sync(session, "can://~/two/")
  assert.deepEqual((await a.sync(laptop, "can://~/two/")).pulled, ["note.md"])
  assert.equal(await readFile(join(laptop, "note.md"), "utf8"), "two")
})

test("a delete the session log explains travels on its own", async () => {
  const a = as(A)
  const state = join(root, "explained-state")
  const dir = await local("explained", { "old.md": "o", "kept.md": "k" })
  await a.sync(dir, "can://~/explained/", { state })
  await mkdir(state, { recursive: true })
  const db = new DatabaseSync(join(state, "edits.db"))
  db.exec("CREATE TABLE edit (id INTEGER PRIMARY KEY, path TEXT, sha TEXT, session TEXT, turn INTEGER, tool TEXT, tool_call TEXT, ts TEXT)")
  db.prepare("INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, NULL, 's', 1, 'settle', '', '')").run(join(dir, "old.md"))
  db.close()
  await rm(join(dir, "old.md"))
  await rm(join(dir, "kept.md"))
  const report = await a.sync(dir, "can://~/explained/", { state })
  assert.deepEqual(report.deleted, ["old.md"])
  assert.deepEqual(report.held, ["kept.md"])
})

test("the folder holds only its own files; the record lives in state", async () => {
  const a = as(A)
  const dir = await local("clean", { "note.md": "text" })
  await a.sync(dir, "can://~/clean/")
  assert.deepEqual(await readdir(dir), ["note.md"])
  const records = await readdir(join(root, "state/sync"))
  const all = await Promise.all(records.map(async (name) => JSON.parse(await readFile(join(root, "state/sync", name), "utf8"))))
  const saved = all.find((record) => record.remote === `people/${A}/clean/`)
  assert.equal(saved.local, dir)
  assert.deepEqual(Object.keys(saved.files), ["note.md"])
})

test("a lost record deletes nothing: same files match, different ones keep both", async () => {
  const a = as(A)
  const dir = await local("lost", { "same.md": "s", "diff.md": "mine" })
  await a.sync(dir, "can://~/lost/", { state: join(root, "lost-state-1") })
  await a.put("can://~/lost/diff.md", "theirs")
  await rm(join(dir, "same.md"))
  const report = await a.sync(dir, "can://~/lost/", { state: join(root, "lost-state-2") })
  assert.deepEqual(report.deleted, [])
  assert.deepEqual(report.pulled, ["same.md"])
  assert.deepEqual(report.kept_both, ["diff.md"])
})

test("deletes travel both ways, only onto unchanged files", async () => {
  const a = as(A)
  const laptop = await local("del/laptop", { "gone.md": "x", "kept.md": "y", "back.md": "z" })
  const session = await local("del/session", {})
  await a.sync(laptop, "can://~/del/")
  await a.sync(session, "can://~/del/")
  await rm(join(laptop, "gone.md"))
  assert.deepEqual((await a.sync(laptop, "can://~/del/")).held, ["gone.md"], "unexplained deletes wait")
  assert.deepEqual((await a.sync(laptop, "can://~/del/", { deletes: "all" })).deleted, ["gone.md"])
  assert.deepEqual((await a.sync(session, "can://~/del/")).removed, ["gone.md"])
  const trashed = (await readdir(join(root, "trash"))).filter((name) => name.startsWith("gone "))
  assert.equal(trashed.length, 1, "removed files go to the Trash")
  assert.equal(await readFile(join(root, "trash", trashed[0]), "utf8"), "x")
  // Deleted here, edited there: nothing is lost.
  await rm(join(session, "kept.md"))
  await writeFile(join(laptop, "kept.md"), "y, edited")
  await a.sync(laptop, "can://~/del/")
  assert.deepEqual((await a.sync(session, "can://~/del/")).pulled, ["kept.md"])
  assert.equal(await readFile(join(session, "kept.md"), "utf8"), "y, edited")
})

test("edits on both sides never merge, even on different lines", async () => {
  const a = as(A)
  const dir = await local("merge", { "doc.md": "one\ntwo\nthree\n" })
  await a.sync(dir, "can://~/merge/")
  await a.put("can://~/merge/doc.md", "ONE\ntwo\nthree\n")
  await writeFile(join(dir, "doc.md"), "one\ntwo\nTHREE\n")
  assert.deepEqual((await a.sync(dir, "can://~/merge/")).kept_both, ["doc.md"])
  assert.equal(await readFile(join(dir, "doc.md"), "utf8"), "one\ntwo\nTHREE\n")
  assert.equal(await readFile(join(dir, "doc.conflict.md"), "utf8"), "ONE\ntwo\nthree\n")
})

test("both edited keeps both, on both sides", async () => {
  const a = as(A)
  const dir = await local("both", { "doc.md": "v1\n", "img.bin": Buffer.from([0, 1]) })
  await a.sync(dir, "can://~/both/")
  await a.put("can://~/both/doc.md", "theirs\n")
  await a.put("can://~/both/img.bin", Buffer.from([0, 2]))
  await writeFile(join(dir, "doc.md"), "mine\n")
  await writeFile(join(dir, "img.bin"), Buffer.from([0, 3]))
  assert.deepEqual((await a.sync(dir, "can://~/both/")).kept_both, ["doc.md", "img.bin"])
  assert.equal(await readFile(join(dir, "doc.md"), "utf8"), "mine\n")
  assert.equal(await readFile(join(dir, "doc.conflict.md"), "utf8"), "theirs\n")
  assert.deepEqual(await readFile(join(dir, "img.conflict.bin")), Buffer.from([0, 2]))
  assert.equal((await a.cat("can://~/both/doc.md")).toString(), "mine\n")
  assert.equal((await a.cat("can://~/both/doc.conflict.md")).toString(), "theirs\n")
  const again = await a.sync(dir, "can://~/both/")
  assert.deepEqual(again.unchanged, ["doc.conflict.md", "doc.md", "img.bin", "img.conflict.bin"])
})

test("conflict names skip ones already taken", () => {
  const taken = new Set(["a/note.conflict.md"])
  assert.equal(conflict_name("a/note.md", (n) => taken.has(n)), "a/note.conflict-2.md")
  assert.equal(conflict_name("Makefile", () => false), "Makefile.conflict")
  assert.equal(conflict_name("dir.v2/poster.html.gz", () => false), "dir.v2/poster.conflict.html.gz")
})

test("sync adopts identical files it never saw, keeps both of different ones", async () => {
  const a = as(A)
  await a.put("can://~/adopt/same.md", "same")
  await a.put("can://~/adopt/other.md", "theirs")
  const dir = await local("adopt", { "same.md": "same", "other.md": "mine" })
  const report = await a.sync(dir, "can://~/adopt/")
  assert.deepEqual(report.adopted, ["same.md"])
  assert.deepEqual(report.kept_both, ["other.md"])
})

test("sync into someone else's folder fails loudly", async () => {
  const dir = await local("intrude", { "x.md": "x" })
  await assert.rejects(as(B).sync(dir, `can://people/${A}/vault/`), { status: 403 })
})

test("both changed: ours from session edits replays onto theirs", async () => {
  const a = as(A)
  const state = join(root, "replay-state")
  const dir = await local("replay", { "doc.md": "title\nbody\nend\n", "clash.md": "one\n" })
  await a.sync(dir, "can://~/replay/", { state })
  const session = join(root, "replay-session.jsonl")
  const call = (id, path, oldText, newText) =>
    JSON.stringify({ type: "message", message: { role: "assistant", content: [{ type: "toolCall", id, name: "edit", arguments: { path, edits: [{ oldText, newText }] } }] } })
  await writeFile(session, [call("c1", "doc.md", "body", "BODY"), call("c2", "clash.md", "one", "ours")].join("\n") + "\n")
  await writeFile(join(dir, "doc.md"), "title\nBODY\nend\n")
  await writeFile(join(dir, "clash.md"), "ours\n")
  const db = new DatabaseSync(join(state, "edits.db"))
  db.exec("CREATE TABLE edit (id INTEGER PRIMARY KEY, path TEXT, sha TEXT, session TEXT, turn INTEGER, tool TEXT, tool_call TEXT, ts TEXT)")
  const log = db.prepare("INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, ?, ?, 4, 'edit', ?, ?)")
  const hash = (text) => createHash("sha256").update(text).digest("hex")
  const later = new Date(Date.now() + 1000).toISOString()
  log.run(join(dir, "doc.md"), hash("title\nBODY\nend\n"), session, "c1", later)
  log.run(join(dir, "clash.md"), hash("ours\n"), session, "c2", later)
  db.close()
  await a.put("can://~/replay/doc.md", "TITLE\nbody\nend\n")
  await a.put("can://~/replay/clash.md", "theirs\n")

  const report = await a.sync(dir, "can://~/replay/", { state })
  assert.deepEqual(report.replayed, ["doc.md"])
  assert.equal(await readFile(join(dir, "doc.md"), "utf8"), "TITLE\nBODY\nend\n")
  assert.equal((await a.cat("can://~/replay/doc.md")).toString(), "TITLE\nBODY\nend\n")
  assert.deepEqual(report.kept_both, ["clash.md"], "their change removed our oldText")
  assert.deepEqual(report.sessions["clash.md"], { session, turn: 4 })
})
