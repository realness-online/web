import { test } from "node:test"
import assert from "node:assert/strict"
import { ignorer, parse_ignore } from "#root/src/files/ignore.js"

const rules = (text) => ignorer(parse_ignore(text))

test("names match at any depth; anchored paths match from the root", () => {
  const ignored = rules("renders/\n/drafts\n*.mov\n")
  assert.equal(ignored("renders", true), true)
  assert.equal(ignored("a/b/renders/x.png"), true)
  assert.equal(ignored("renders"), false, "a file named like a folder rule")
  assert.equal(ignored("drafts/x.md"), true)
  assert.equal(ignored("notes/drafts/x.md"), false)
  assert.equal(ignored("deep/clip.mov"), true)
  assert.equal(ignored("notes/a.md"), false)
})

test("** crosses folders, ? is one character, ! re-includes", () => {
  const ignored = rules("a/**/z.md\nfile?.txt\n*.log\n!keep.log\n")
  assert.equal(ignored("a/z.md"), true)
  assert.equal(ignored("a/b/c/z.md"), true)
  assert.equal(ignored("file1.txt"), true)
  assert.equal(ignored("file10.txt"), false)
  assert.equal(ignored("x.log"), true)
  assert.equal(ignored("keep.log"), false)
})

test("a file inside an ignored folder stays ignored", () => {
  const ignored = rules("build/\n!build/keep.md\n")
  assert.equal(ignored("build/keep.md"), true)
})

test("comments and blank lines drop out; no file ignores nothing", () => {
  assert.equal(rules("# x.md\n\n")("x.md"), false)
  assert.equal(rules("")("anything"), false)
})
