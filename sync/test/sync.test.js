/**
 * The sync service end to end over HTTP: nobody reaches another person's files.
 */
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import { mkdir, rm } from "node:fs/promises"
import { request } from "node:http"
import { randomUUID } from "node:crypto"
import { disk } from "brayness-can-store/disk"
import { dev_issuer } from "../src/dev-token.js"
import { rights } from "../src/rights.js"
import { sync_service } from "../src/server.js"

const A = "+15555550100"
const B = "+15555550101"
const dir = new URL(`../../dist/sync-test-${randomUUID()}`, import.meta.url).pathname
const issuer = dev_issuer()
const lines = []
const storage = disk(dir)
const cache = rights(storage)
let server
let base

before(async () => {
  await mkdir(dir, { recursive: true })
  server = sync_service({
    storage,
    rights: cache,
    project: issuer.project,
    certs: issuer.certs,
    origins: ["https://realness.online"],
    log: (l) => lines.push(l),
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server.close()
  await rm(dir, { recursive: true, force: true })
})

const as = (phone, options) => ({ authorization: `Bearer ${issuer.token(phone, options)}` })
const call = (method, path, { headers = {}, body } = {}) => fetch(`${base}/${path}`, { method, headers, body })
const status = async (...args) => (await call(...args)).status

test("an owner writes, reads, lists, and deletes their own files", async () => {
  assert.equal(await status("PUT", `people/${A}/vault/note.md`, { headers: as(A), body: "mine" }), 200)
  const read = await call("GET", `people/${A}/vault/note.md`, { headers: as(A) })
  assert.equal(read.status, 200)
  assert.equal(await read.text(), "mine")
  const listed = await (await call("GET", `people/${A}/vault/`, { headers: as(A) })).json()
  assert.deepEqual(listed, { files: ["note.md"], folders: [] })
  assert.equal(await status("DELETE", `people/${A}/vault/note.md`, { headers: as(A) }), 204)
  assert.equal(await status("GET", `people/${A}/vault/note.md`, { headers: as(A) }), 404)
})

test("a deep list maps every file below to its etag", async () => {
  const put = await call("PUT", `people/${A}/deep/x/y.md`, { headers: as(A), body: "y" })
  const listed = await (await call("GET", `people/${A}/deep/?deep`, { headers: as(A) })).json()
  assert.deepEqual(listed, { "x/y.md": put.headers.get("etag").replace(/"/g, "") })
  assert.equal(await status("GET", `people/${A}/deep/?deep`, { headers: as(B) }), 403)
})

test("another person never reaches my private files", async () => {
  await call("PUT", `people/${A}/vault/secret.md`, { headers: as(A), body: "secret" })
  await call("PUT", `people/${A}/relations.html.gz`, { headers: as(A), body: "friends" })
  for (const path of [`people/${A}/vault/secret.md`, `people/${A}/relations.html.gz`, `people/${A}/vault/`, `people/${A}/`]) {
    assert.equal(await status("GET", path, { headers: as(B) }), 403, path)
    assert.equal(await status("GET", path), 403, path)
  }
  assert.equal(await status("PUT", `people/${A}/vault/secret.md`, { headers: as(B), body: "mine now" }), 403)
  assert.equal(await status("DELETE", `people/${A}/vault/secret.md`, { headers: as(B) }), 403)
  assert.equal(await (await call("GET", `people/${A}/vault/secret.md`, { headers: as(A) })).text(), "secret")
})

test("denial does not reveal whether a file exists", async () => {
  assert.equal(await status("GET", `people/${A}/vault/secret.md`, { headers: as(B) }), 403)
  assert.equal(await status("GET", `people/${A}/vault/nothing-here.md`, { headers: as(B) }), 403)
})

test("public posters read for anyone, write for the owner only", async () => {
  await call("PUT", `people/${A}/posters/1.html.gz`, { headers: as(A), body: "<svg/>" })
  assert.equal(await status("GET", `people/${A}/posters/1.html.gz`), 200)
  assert.equal(await status("GET", `people/${A}/posters/`), 200)
  assert.equal(await status("PUT", `people/${A}/posters/1.html.gz`, { body: "x" }), 403)
  assert.equal(await status("PUT", `people/${A}/posters/1.html.gz`, { headers: as(B), body: "x" }), 403)
})

test("pins and traversal stay out of reach", async () => {
  await call("GET", `people/${A}/vault/`, { headers: as(A) }) // pins A on first sight
  for (const who of [as(A), as(B), {}]) {
    assert.equal(await status("GET", `pins/${A}`, { headers: who }), 403)
    assert.equal(await status("PUT", `pins/${A}`, { headers: who, body: "stolen" }), 403)
  }
  // Raw paths: fetch would resolve the dots before sending.
  const raw = (path, headers) =>
    new Promise((done, fail) =>
      request({ host: "127.0.0.1", port: server.address().port, path, headers }, (r) =>
        done(r.resume().statusCode),
      )
        .on("error", fail)
        .end(),
    )
  for (const path of [`/people/${B}/../${A}/vault/secret.md`, `/people/${B}/%2e%2e/${A}/vault/secret.md`, `/people/${B}/./x`]) {
    assert.equal(await raw(path, as(B)), 403, path)
  }
  assert.equal(await raw(`/people/${A}/../${A}/vault/secret.md`, as(A)), 403)
})

test("a recycled number and a bad token are refused", async () => {
  await call("GET", `people/${A}/vault/`, { headers: as(A) })
  assert.equal(await status("GET", `people/${A}/vault/`, { headers: as(A, { uid: "someone-new" }) }), 401)
  assert.equal(await status("GET", `people/${A}/vault/`, { headers: as(A, { lifetime: -10 }) }), 401)
  assert.equal(await status("GET", `people/${A}/vault/`, { headers: { authorization: "Bearer nope" } }), 401)
  assert.equal(await status("GET", `people/${A}/vault/`, { headers: { authorization: "Basic x" } }), 401)
})

test("conditional writes refuse a stale version", async () => {
  const first = await call("PUT", `people/${A}/vault/doc.md`, { headers: { ...as(A), "if-none-match": "*" }, body: "v1" })
  assert.equal(first.status, 200)
  const v1 = first.headers.get("etag")
  assert.equal(await status("PUT", `people/${A}/vault/doc.md`, { headers: { ...as(A), "if-none-match": "*" }, body: "again" }), 412)
  assert.equal(await status("PUT", `people/${A}/vault/doc.md`, { headers: { ...as(A), "if-match": v1 }, body: "v2" }), 200)
  assert.equal(await status("PUT", `people/${A}/vault/doc.md`, { headers: { ...as(A), "if-match": v1 }, body: "v3" }), 412)
  assert.equal(await (await call("GET", `people/${A}/vault/doc.md`, { headers: as(A) })).text(), "v2")
})

test("only one of two racing first writes wins", async () => {
  const race = await Promise.all(
    ["one", "two"].map((body) => status("PUT", `people/${A}/vault/race.md`, { headers: { ...as(A), "if-none-match": "*" }, body })),
  )
  assert.deepEqual(race.sort(), [200, 412])
})

test("logs never hold a raw phone number", () => {
  assert.ok(lines.length > 10)
  for (const line of lines) assert.doesNotMatch(line, /\+\d{7,}/, line)
})

test("unknown methods are refused", async () => {
  assert.equal(await status("POST", `people/${A}/vault/x`, { headers: as(A), body: "x" }), 405)
})

// g5 as a library: writing rights through sync forgets the cached grants.
test("a rights change through sync applies at once", async () => {
  const box = `/${A}/harnesses/1`
  const page = (href) =>
    `<ul><li itemscope itemtype="https://schema.org/DigitalDocumentPermission"><meta itemprop="grantee" content="${box}"><meta itemprop="permissionType" content="https://schema.org/ReadPermission"><a itemprop="about" href="${href}">x</a></li></ul>`
  await call("PUT", `people/${A}/rights.html`, { headers: as(A), body: page(`/${A}/plans/`) })
  const first = await cache.grants(A)
  assert.equal(first.grants[0].path, `/${A}/plans/`)
  await call("PUT", `people/${A}/rights.html`, { headers: as(A), body: page(`/${A}/vault/`) })
  const second = await cache.grants(A)
  assert.equal(second.grants[0].path, `/${A}/vault/`)
  assert.notEqual(second.version, first.version)
  await call("PUT", `people/${A}/rights.html`, { headers: as(A), body: "<li itemscope" })
  assert.deepEqual((await cache.grants(A)).grants, [])
})

test("only allowed sites may call from a browser", async () => {
  const preflight = (origin) =>
    call("OPTIONS", `people/${A}/vault/`, {
      headers: { origin, "access-control-request-method": "GET", "access-control-request-headers": "authorization" },
    })
  const good = await preflight("https://realness.online")
  assert.equal(good.status, 204)
  assert.equal(good.headers.get("access-control-allow-origin"), "https://realness.online")
  assert.match(good.headers.get("access-control-allow-headers"), /authorization/)
  const bad = await preflight("https://evil.example")
  assert.equal(bad.status, 403)
  assert.equal(bad.headers.get("access-control-allow-origin"), null)

  const read = await call("GET", `people/${A}/posters/`, { headers: { origin: "https://realness.online" } })
  assert.equal(read.headers.get("access-control-allow-origin"), "https://realness.online")
  assert.equal(read.headers.get("access-control-expose-headers"), "etag")
  const stranger_site = await call("GET", `people/${A}/posters/`, { headers: { origin: "https://evil.example" } })
  assert.equal(stranger_site.headers.get("access-control-allow-origin"), null)
})
