/**
 * can() denies by default. Each lesson from Realness `storage.rules` is a test
 * here before anything moves behind the storage door.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { can } from "../src/can.js"
import { read_rights } from "../src/rights.js"

const A = "+14155550001"
const B = "+14155550002"
const scott = { phone: A }
const other = { phone: B }
const stranger = null
const box = { instance: `/${A}/harnesses/1726000000000` }
const foreign_box = { instance: `/${B}/harnesses/1726000000000` }

const page = (items) => `<!doctype html><html><body><ul>${items}</ul></body></html>`
const grant = (grantee, type, href) => `
  <li itemscope itemtype="https://schema.org/DigitalDocumentPermission">
    <meta itemprop="grantee" content="${grantee}">
    <meta itemprop="permissionType" content="https://schema.org/${type}Permission">
    <a itemprop="about" href="${href}">${href}</a>
  </li>`

test("strangers are denied everything private", () => {
  for (const action of ["get", "list", "write", "delete"]) {
    assert.equal(can(stranger, action, `people/${A}/relations.html.gz`), false)
    assert.equal(can(stranger, action, `people/${A}/harnesses/1/sessions/x`), false)
    assert.equal(can(stranger, action, `subscriptions/${A}/sub`), false)
    assert.equal(can(stranger, action, `people/${A}/plans/brayness.md`), false)
  }
  assert.equal(can(stranger, "write", `people/${A}/posters/1.html.gz`), false)
  assert.equal(can(stranger, "list", "people/"), false)
})

test("unknown actions, subjects, and roots deny", () => {
  assert.equal(can(scott, "read", `people/${A}/x`), false)
  assert.equal(can(scott, "admin", `people/${A}/x`), false)
  assert.equal(can({ phone: "scott" }, "get", `people/${A}/rights.html`), false)
  assert.equal(can({ instance: "/+1/harnesses/x" }, "get", `people/${A}/harnesses/x/y`), false)
  assert.equal(can(scott, "get", "other/thing"), false)
  assert.equal(can(scott, "get", "people/not-a-number/x"), false)
})

test("paths that could escape deny, even for the owner", () => {
  for (const path of [
    `people/${A}/../${B}/relations.html.gz`,
    `people/${A}//rights.html`,
    `/people/${A}/rights.html`,
    `people/${A}/%2e%2e/x`,
    `people/${A}/a\\b`,
    "",
    null,
  ]) {
    assert.equal(can(scott, "get", path), false, String(path))
  }
})

test("the owner reaches everything under their number", () => {
  for (const action of ["get", "list", "write", "delete"]) {
    assert.equal(can(scott, action, `people/${A}/relations.html.gz`), true)
    assert.equal(can(scott, action, `people/${A}/rights.html`), true)
    assert.equal(can(scott, action, `subscriptions/${A}/sub`), true)
    assert.equal(can(scott, action, `people/${A}/harnesses/1/lease`), true)
  }
})

test("another person is a stranger to my private files", () => {
  for (const action of ["get", "list", "write", "delete"]) {
    assert.equal(can(other, action, `people/${A}/relations.html.gz`), false)
    assert.equal(can(other, action, `people/${A}/rights.html`), false)
    assert.equal(can(other, action, `subscriptions/${A}/sub`), false)
    assert.equal(can(other, action, `people/${A}/harnesses/1/lease`), false)
  }
})

// storage.rules: a permissive match anywhere undid relations.html.gz; every
// public rule had to exclude it by name.
test("relations stay private next to public files", () => {
  assert.equal(can(stranger, "get", `people/${A}/index.html.gz`), true)
  assert.equal(can(stranger, "get", `people/${A}/relations.html.gz`), false)
  assert.equal(can(stranger, "get", `people/${A}/posters/relations.html.gz`), true) // a poster, by name only
})

// storage.rules: subscriptions sit outside people/ so endpoints never leak.
test("subscriptions are owner only", () => {
  assert.equal(can(other, "get", `subscriptions/${A}/sub`), false)
  assert.equal(can(scott, "get", `subscriptions/${B}/sub`), false)
  assert.equal(can(scott, "list", `subscriptions/${A}/`), true)
  assert.equal(can(other, "list", `subscriptions/${A}/`), false)
  assert.equal(can(scott, "list", "subscriptions/"), false)
})

test("usage is read-only to its owner", () => {
  assert.equal(can(scott, "get", `usage/${A}/2026-09-27/row.html`), true)
  assert.equal(can(scott, "list", `usage/${A}/2026-09-27/`), true)
  assert.equal(can(scott, "write", `usage/${A}/2026-09-27/row.html`), false)
  assert.equal(can(scott, "delete", `usage/${A}/2026-09-27/row.html`), false)
  assert.equal(can(other, "get", `usage/${A}/2026-09-27/row.html`), false)
  assert.equal(can(scott, "list", "usage/"), false)
})

// Realness serves index.html.gz and three folders; the rest stays private.
test("public is an allowlist", () => {
  assert.equal(can(stranger, "get", `people/${A}/thoughts/1738103761047.html.gz`), true)
  assert.equal(can(stranger, "list", `people/${A}/statements/`), true)
  assert.equal(can(stranger, "get", `people/${A}/events/1.html.gz`), false)
  assert.equal(can(stranger, "get", `people/${A}/notes.md`), false)
  assert.equal(can(stranger, "get", `people/${A}/posters`), false)
  assert.equal(can(stranger, "list", `people/${A}/vault/`), false)
})

// storage.rules: the phonebook lists people/, and a list returns names, never bytes.
test("the phonebook lists names for people signed in", () => {
  assert.equal(can(other, "list", "people/"), true)
  assert.equal(can(other, "get", "people/"), false)
  assert.equal(can(box, "list", "people/"), false)
})

// storage.rules: the app never lists a person's root; listing it denies.
test("a person's root does not list for others", () => {
  assert.equal(can(other, "list", `people/${A}/`), false)
  assert.equal(can(stranger, "list", `people/${A}`), false)
  assert.equal(can(stranger, "list", `people/${A}/posters/`), true)
  assert.equal(can(stranger, "get", `people/${A}/statements/1.html.gz`), true)
})

test("harness folders are private, whatever their name", () => {
  assert.equal(can(stranger, "list", `people/${A}/harnesses/`), false)
  assert.equal(can(other, "get", `people/${A}/vault/note.md`), false)
})

test("an instance reaches its own folder and nothing else ungranted", () => {
  assert.equal(can(box, "write", `people/${A}/harnesses/1726000000000/sessions/s.jsonl`), true)
  assert.equal(can(box, "get", `people/${A}/harnesses/1726000000001/sessions/s.jsonl`), false)
  assert.equal(can(box, "get", `people/${A}/relations.html.gz`), false)
  assert.equal(can(box, "get", `people/${A}/rights.html`), false)
  assert.equal(can(box, "get", `subscriptions/${A}/sub`), false)
  assert.equal(can(box, "get", `people/${A}/plans/brayness.md`), false)
})

test("grants give an instance exactly what they name", () => {
  const grants = read_rights(
    page(
      grant(box.instance, "Read", `/${A}/plans/`) +
        grant(box.instance, "Write", `/${A}/vault/note.md`) +
        grant(foreign_box.instance, "Write", `/${A}/vault/`) +
        grant(box.instance, "Write", `/${B}/vault/`),
    ),
  )
  assert.equal(can(box, "get", `people/${A}/plans/brayness.md`, grants), true)
  assert.equal(can(box, "list", `people/${A}/plans/`, grants), true)
  assert.equal(can(box, "write", `people/${A}/plans/brayness.md`, grants), false)
  assert.equal(can(box, "write", `people/${A}/vault/note.md`, grants), true)
  assert.equal(can(box, "get", `people/${A}/vault/other.md`, grants), false)
  assert.equal(can(box, "get", `people/${A}/plansx/secret`, grants), false)
  // Grants from one owner never reach another owner's files.
  assert.equal(can(box, "write", `people/${B}/vault/x`, grants), false)
  assert.equal(can(foreign_box, "write", `people/${A}/vault/x`, grants), false)
})

test("grants never reach the rights page or subscriptions", () => {
  const grants = read_rights(page(grant(box.instance, "Write", `/${A}/`)))
  assert.equal(can(box, "write", `people/${A}/vault/x`, grants), true)
  assert.equal(can(box, "get", `people/${A}/rights.html`, grants), false)
  assert.equal(can(box, "write", `people/${A}/rights.html`, grants), false)
  assert.equal(can(box, "get", `subscriptions/${A}/sub`, grants), false)
})

// Instance ids are timestamps, so two people can hold the same one.
test("another person's instance never borrows a same-named one", () => {
  const grants = read_rights(page(grant(box.instance, "Read", `/${A}/plans/`)))
  assert.equal(can(foreign_box, "get", `people/${A}/plans/p.md`, grants), false)
  assert.equal(can(foreign_box, "write", `people/${A}/harnesses/1726000000000/s.jsonl`), false)
})

test("revoking is deleting one triple", () => {
  const one = grant(box.instance, "Read", `/${A}/plans/`)
  assert.equal(can(box, "get", `people/${A}/plans/p.md`, read_rights(page(one))), true)
  assert.equal(can(box, "get", `people/${A}/plans/p.md`, read_rights(page(""))), false)
})

test("a commented-out grant is revoked", () => {
  const html = page(`<!-- ${grant(box.instance, "Read", `/${A}/plans/`)} -->`)
  assert.deepEqual(read_rights(html), [])
  assert.equal(can(box, "get", `people/${A}/plans/p.md`, read_rights(html)), false)
})

test("a malformed rights page throws, so the caller denies", () => {
  const cases = [
    page(`<li itemscope itemtype="https://schema.org/DigitalDocumentPermission"><meta itemprop="grantee" content="x"></li>`),
    page(grant(box.instance, "Admin", `/${A}/`)),
    page(`<li itemscope itemtype="https://schema.org/DigitalDocumentPermission">`),
    page(grant(box.instance, "Read", `/${A}/`) + "</div>"),
    page(`<li itemscope itemtype="https://schema.org/DigitalDocumentPermission"><meta itemprop="grantee" content="a"><meta itemprop="grantee" content="b"><meta itemprop="permissionType" content="https://schema.org/ReadPermission"><a itemprop="about" href="/x/">x</a></li>`),
    page(`<li itemscope itemtype="https://schema.org/DigitalDocumentPermission"><div itemprop="grantee" itemscope><meta itemprop="url" content="x"></div></li>`),
    page(`<li itemscope itemtype="https://schema.org/DigitalDocumentPermission" itemref="elsewhere"></li>`),
    page(`<script>"<li itemscope>"</script>`),
    null,
  ]
  for (const html of cases) assert.throws(() => read_rights(html))
})
