import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { APP_PORT, InferError, START, infer } from "../src/infer.js"

const base = fileURLToPath(new URL("../../../../../artifacts/brayness/", import.meta.url))
mkdirSync(base, { recursive: true })
const root = mkdtempSync(join(base, "infer-test-"))
after(() => rmSync(root, { recursive: true, force: true }))

let n = 0
function app(files) {
  const dir = join(root, `app-${n++}`)
  mkdirSync(dir)
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  return dir
}

const HANDLER = 'export default { async fetch(request) { return new Response("hi") } }\n'
const ELF = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(60)])

test("server.js with a default export is a handler on our server", () => {
  assert.deepEqual(infer(app({ "server.js": HANDLER })), { kind: "handler", runtime: "node", start: START, port: APP_PORT })
})

test("a handler may sit beside its static files and a plain package.json", () => {
  const dir = app({ "server.js": HANDLER, "index.html": "<p>hi</p>", "package.json": '{"type": "module"}' })
  assert.equal(infer(dir).kind, "handler")
})

test("index.html alone is a site: no VM, no port", () => {
  assert.deepEqual(infer(app({ "index.html": "<p>hi</p>" })), { kind: "site", runtime: null, start: null, port: null })
})

test("server.js without a default export is refused", () => {
  const dir = app({ "server.js": 'process.getBuiltinModule("node:http").createServer().listen(8080)\n' })
  assert.throws(() => infer(dir), (error) => error instanceof InferError && /no default export/.test(error.message))
})

test("other stacks are refused by name, pointing at the handler", () => {
  const cases = [
    [{ Procfile: "web: node server.js\n", "server.js": HANDLER }, /a Procfile/],
    [{ "main.py": "print(1)\n" }, /python \(main.py\)/],
    [{ "app.py": "", "server.js": HANDLER }, /python \(app.py\)/],
  ]
  for (const [files, reason] of cases) {
    assert.throws(() => infer(app(files)), (error) => error instanceof InferError && reason.test(error.message) && /fetch handler/.test(error.message))
  }
})

test("an executable is refused", () => {
  const dir = app({ "index.html": "" })
  writeFileSync(join(dir, "server"), ELF)
  chmodSync(join(dir, "server"), 0o755)
  assert.throws(() => infer(dir), /an executable \(server\)/)
})

test("nothing to run and nothing to serve is refused", () => {
  assert.throws(() => infer(app({ "README.md": "hi" })), /no server.js and no index.html/)
})

// Built by concatenation: host files may not contain the literal (boundary test).
const REQ = "req" + "uire"

test("standard library only: node: built-ins and relative files pass", () => {
  const dir = app({
    "server.js": 'import { createHash } from "node:crypto"\nimport { page } from "./lib/page.js"\nexport default { fetch: () => new Response(page()) }\n',
    "package.json": '{"type": "module"}',
  })
  mkdirSync(join(dir, "lib"))
  writeFileSync(join(dir, "lib/page.js"), 'export * from "../util.js"\nexport const page = () => "hi"\n')
  assert.equal(infer(dir).kind, "handler")
})

test("standard library only: each way past it is named", () => {
  const cases = [
    ['import express from "express"\n', /imports 'express'/],
    ['import fs from "fs"\n', /imports 'fs'/],
    ['const h = await import("hono")\n', /imports 'hono'/],
    [`const x = ${REQ}("lodash")\n`, /imports 'lodash'/],
    ['export { a } from "left-pad"\n', /imports 'left-pad'/],
    ['import "/etc/passwd"\n', /imports '\/etc\/passwd'/],
  ]
  for (const [line, reason] of cases) {
    const dir = app({ "server.js": `${line}export default { fetch: () => new Response("x") }\n` })
    assert.throws(() => infer(dir), (error) => error instanceof InferError && /standard library only/.test(error.message) && reason.test(error.message), line)
  }
})

test("standard library only: a modules folder and declared dependencies are refused", () => {
  const withModules = app({ "server.js": HANDLER })
  mkdirSync(join(withModules, ["node", "modules"].join("_"), "x"), { recursive: true })
  assert.throws(() => infer(withModules), /_modules\/: apps take no dependencies/)
  const declared = app({ "server.js": HANDLER, "package.json": JSON.stringify({ dependencies: { hono: "4" }, devDependencies: { vitest: "1" } }) })
  assert.throws(() => infer(declared), (error) => /dependencies: hono/.test(error.message) && /devDependencies: vitest/.test(error.message))
})
