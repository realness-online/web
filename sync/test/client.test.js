/**
 * The gsutil-style client against a real sync service on disk.
 */
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { disk } from "brayness-can-store/disk"
import { client } from "../src/client.js"
import { dev_issuer } from "../src/dev-token.js"
import { rights } from "../src/rights.js"
import { sync_service } from "../src/server.js"

const A = "+15555550100"
const B = "+15555550101"
const root = new URL(`../../dist/client-test-${randomUUID()}/`, import.meta.url).pathname
const issuer = dev_issuer()
const storage = disk(join(root, "bucket"))
let server
let url

before(async () => {
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

test("text bases are kept for merging; binaries are not", async () => {
  const a = as(A)
  const dir = await local("base", { "note.md": "text", "img.bin": Buffer.from([0, 1]) })
  await a.sync(dir, "can://~/base/")
  assert.equal(await readFile(join(dir, ".can-base/note.md"), "utf8"), "text")
  await assert.rejects(readFile(join(dir, ".can-base/img.bin")), { code: "ENOENT" })
  assert.ok(!(await a.walk("can://~/base/"))[".can-base/note.md"], "the base never uploads")
})

test("deletes travel both ways, only onto unchanged files", async () => {
  const a = as(A)
  const laptop = await local("del/laptop", { "gone.md": "x", "kept.md": "y", "back.md": "z" })
  const session = await local("del/session", {})
  await a.sync(laptop, "can://~/del/")
  await a.sync(session, "can://~/del/")
  await rm(join(laptop, "gone.md"))
  assert.deepEqual((await a.sync(laptop, "can://~/del/")).deleted, ["gone.md"])
  assert.deepEqual((await a.sync(session, "can://~/del/")).removed, ["gone.md"])
  // Deleted here, edited there: nothing is lost.
  await rm(join(session, "kept.md"))
  await writeFile(join(laptop, "kept.md"), "y, edited")
  await a.sync(laptop, "can://~/del/")
  assert.deepEqual((await a.sync(session, "can://~/del/")).conflicts, ["kept.md"])
  assert.equal((await a.cat("can://~/del/kept.md")).toString(), "y, edited")
})

test("sync reports a conflict instead of overwriting either side", async () => {
  const a = as(A)
  const dir = await local("conflict", { "doc.md": "v1" })
  await a.sync(dir, "can://~/conflict/")
  await a.put("can://~/conflict/doc.md", "changed elsewhere")
  await writeFile(join(dir, "doc.md"), "v2 here")
  assert.deepEqual((await a.sync(dir, "can://~/conflict/")).conflicts, ["doc.md"])
  assert.equal((await a.cat("can://~/conflict/doc.md")).toString(), "changed elsewhere")
  assert.equal(await readFile(join(dir, "doc.md"), "utf8"), "v2 here")
})

test("sync adopts identical files it never saw, conflicts on different ones", async () => {
  const a = as(A)
  await a.put("can://~/adopt/same.md", "same")
  await a.put("can://~/adopt/other.md", "theirs")
  const dir = await local("adopt", { "same.md": "same", "other.md": "mine" })
  const report = await a.sync(dir, "can://~/adopt/")
  assert.deepEqual(report.adopted, ["same.md"])
  assert.deepEqual(report.conflicts, ["other.md"])
})

test("sync into someone else's folder fails loudly", async () => {
  const dir = await local("intrude", { "x.md": "x" })
  await assert.rejects(as(B).sync(dir, `can://people/${A}/vault/`), { status: 403 })
})
