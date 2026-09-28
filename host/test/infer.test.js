import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { APP_PORT, InferError, infer } from "../src/infer.js"

const base = fileURLToPath(new URL("../../../../artifacts/brayness/", import.meta.url))
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

test("package.json with a plain node start script", () => {
  const dir = app({ "package.json": JSON.stringify({ scripts: { start: "node src/server.js" } }) })
  assert.deepEqual(infer(dir), { kind: "node", runtime: "node", start: ["node", "src/server.js"], port: APP_PORT })
})

test("package.json falls back to main, then a known entry file", () => {
  assert.deepEqual(infer(app({ "package.json": JSON.stringify({ main: "api.js" }), "api.js": "" })).start, ["node", "api.js"])
  assert.deepEqual(infer(app({ "package.json": "{}", "server.js": "" })).start, ["node", "server.js"])
})

test("a start script that is not plain node is refused, not guessed", () => {
  const dir = app({ "package.json": JSON.stringify({ scripts: { start: "next start" } }) })
  assert.throws(() => infer(dir), InferError)
})

test("package.json with no server is build tooling; the site wins", () => {
  const dir = app({ "package.json": JSON.stringify({ scripts: { build: "vite build" } }), "index.html": "" })
  assert.deepEqual(infer(dir), { kind: "site", runtime: null, start: null, port: null })
})

test("python entry file", () => {
  assert.deepEqual(infer(app({ "app.py": "", "requirements.txt": "" })), { kind: "python", runtime: "python", start: ["python3", "app.py"], port: APP_PORT })
})

test("a python server beside a package.json that only builds assets", () => {
  const dir = app({ "package.json": JSON.stringify({ scripts: { build: "vite build" } }), "main.py": "" })
  assert.equal(infer(dir).runtime, "python")
})

test("Procfile wins and names the runtime by its command", () => {
  const dir = app({ Procfile: "web: python3 serve.py\n", "package.json": "{}", "server.js": "" })
  assert.deepEqual(infer(dir).start, ["python3", "serve.py"])
  assert.equal(infer(dir).runtime, "python")
})

test("Procfile commands that need a shell are refused", () => {
  assert.throws(() => infer(app({ Procfile: "web: node a.js && node b.js" })), /needs a shell/)
})

test("Procfile with an unknown runtime is refused", () => {
  assert.throws(() => infer(app({ Procfile: "web: ruby app.rb" })), /known runtimes/)
})

test("one ELF executable runs with no runtime", () => {
  // The magic is all infer reads; a real binary would be Mach-O on the Mac.
  const dir = app({ server: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]) })
  chmodSync(join(dir, "server"), 0o755)
  assert.deepEqual(infer(dir), { kind: "binary", runtime: null, start: ["./server"], port: APP_PORT })
})

test("an executable script is not a binary", () => {
  const dir = app({ "run.sh": "#!/bin/sh\n", "index.html": "" })
  chmodSync(join(dir, "run.sh"), 0o755)
  assert.equal(infer(dir).kind, "site")
})

test("nothing to run and nothing to serve", () => {
  assert.throws(() => infer(app({ "README.md": "" })), /no server found/)
})
