/**
 * The boundary check: control and the live side must not mix.
 *
 * Two directories, one rule each:
 *
 *   control/  may only reach orchestrator/ through its HTTP API. It starts
 *             the server and talks to it. It must not import, read, or write
 *             anything inside the package.
 *   orchestrator/  must not know control exists. No node, no npm, no path into it.
 *
 * The rule is worth a test because it is invisible in a diff: importing a
 * session module to read a field is one line and it dissolves the split. This
 * is the cheapest thing that fails when that happens.
 */
import { readFile, readdir, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import { test } from "node:test"
import assert from "node:assert/strict"

const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "")
const CONTROL = join(ROOT, "control")
const ORCHESTRATOR = join(ROOT, "orchestrator")

/** Every regular file under a directory, recursively. */
async function files(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__pycache__") continue
      found.push(...(await files(path)))
    } else if (entry.isFile()) {
      found.push(path)
    }
  }
  return found
}

const source = (path) => readFile(path, "utf8")

test("the orchestrator does not know the control plane exists", async () => {
  const offences = []
  for (const path of await files(ORCHESTRATOR)) {
    if (!path.endsWith(".py")) continue
    const text = await source(path)
    for (const line of text.split("\n")) {
      // The control plane's directory name, as a path or an import.
      if (/\bcontrol\//.test(line) || /\bfrom control\b|\bimport control\b/.test(line)) {
        offences.push(`${relative(ROOT, path)}: ${line.trim()}`)
      }
      // Node must not appear in the Python: it is the other world's runtime.
      if (/\bnode_modules\b|\bnpm\b|\brequire\(/.test(line) && !line.trim().startsWith("#")) {
        offences.push(`${relative(ROOT, path)}: ${line.trim()}`)
      }
    }
  }
  assert.deepEqual(offences, [], `orchestrator refers to the control plane:\n${offences.join("\n")}`)
})

test("the control plane reaches sessions only over HTTP", async () => {
  const offences = []
  for (const path of await files(CONTROL)) {
    if (!path.endsWith(".js")) continue
    // This test itself names the paths it forbids.
    if (path.endsWith("boundary.test.js")) continue
    const text = await source(path)
    for (const line of text.split("\n")) {
      const code = line.trim()
      if (code.startsWith("*") || code.startsWith("//")) continue
      // A filesystem path into the package, or an import of a Python module
      // standing in for its API.
      if (/["'`][^"'`]*src\/orchestrator/.test(code)) {
        offences.push(`${relative(ROOT, path)}: ${code}`)
      }
      if (/\bfrom\s+["'`].*orchestrator|require\(.*orchestrator/.test(code)) {
        offences.push(`${relative(ROOT, path)}: ${code}`)
      }
    }
  }
  assert.deepEqual(offences, [], `control reaches into the orchestrator:\n${offences.join("\n")}`)
})

test("the split is real: both directories exist and are not empty", async () => {
  // A boundary test that passes because a directory is missing is worse than
  // none, so assert the two sides are actually there.
  const control_js = (await files(CONTROL)).filter(path => path.endsWith(".js"))
  const python = (await files(ORCHESTRATOR)).filter(path => path.endsWith(".py"))
  assert.ok(control_js.length > 0, "no JavaScript in control/")
  assert.ok(python.length > 0, "no Python in orchestrator/")
  const size = await stat(join(ORCHESTRATOR, "sessions.py"))
  assert.ok(size.size > 1000, "sessions.py looks like a stub")
})