/**
 * The boundary check: control and the live side must not mix.
 *
 *   control/  reaches host/ only over its HTTP API. It starts the server and
 *             talks to it; it never imports a host module.
 *   host/     must not know control exists: no import of it, no path into it,
 *             no npm dependency.
 *
 * Invisible in a diff: importing a session module to read one field is one
 * line, and it dissolves the split. This is the cheapest thing that fails.
 */
import { readFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { test } from "node:test"
import assert from "node:assert/strict"

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "")
const CONTROL = join(ROOT, "control")
const HOST = join(ROOT, "host")

/** Every regular file under a directory, recursively. */
async function files(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (["node_modules", "__pycache__", "term"].includes(entry.name)) continue
      found.push(...(await files(path)))
    } else if (entry.isFile()) {
      found.push(path)
    }
  }
  return found
}

const isComment = (code) => code.startsWith("*") || code.startsWith("//") || code.startsWith("#")

test("the host does not know the control plane exists", async () => {
  const offences = []
  for (const path of await files(HOST)) {
    const text = await readFile(path, "utf8")
    for (const line of text.split("\n")) {
      const code = line.trim()
      if (isComment(code)) continue
      if (/\bcontrol\//.test(code) || /\bnode_modules\b|\bnpm\b|\brequire\(/.test(code)) {
        offences.push(`${relative(ROOT, path)}: ${code}`)
      }
    }
  }
  assert.deepEqual(offences, [], `host refers to the control plane:\n${offences.join("\n")}`)
})

test("the host takes no dependencies", async () => {
  const pkg = JSON.parse(await readFile(join(HOST, "package.json"), "utf8"))
  assert.deepEqual(pkg.dependencies ?? {}, {})
  assert.equal(pkg.devDependencies, undefined)
})

test("the control plane reaches sessions only over HTTP", async () => {
  const offences = []
  for (const path of await files(CONTROL)) {
    if (!path.endsWith(".js") || path.endsWith("boundary.test.js")) continue
    const text = await readFile(path, "utf8")
    for (const line of text.split("\n")) {
      const code = line.trim()
      if (isComment(code)) continue
      if (/\bfrom\s+["'`][^"'`]*\bhost\/(src|main)|import\(\s*["'`][^"'`]*\bhost\/(src|main)|require\(.*\bhost\/(src|main)/.test(code)) {
        offences.push(`${relative(ROOT, path)}: ${code}`)
      }
    }
  }
  assert.deepEqual(offences, [], `control reaches into the host:\n${offences.join("\n")}`)
})

test("the split is real: both directories hold code", async () => {
  // A boundary test that passes because a directory is missing is worse than none.
  const js = (dir) => files(dir).then((found) => found.filter((path) => path.endsWith(".js")))
  assert.ok((await js(CONTROL)).length > 0, "no JavaScript in control/")
  assert.ok((await js(HOST)).some((path) => path.endsWith("sessions.js")), "no host/src/sessions.js")
})
