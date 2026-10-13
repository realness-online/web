import { readFile as read_file, readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import { createRequire as create_require } from "node:module"
import { fileURLToPath as file_url_to_path } from "node:url"
import { test } from "node:test"
import assert from "node:assert/strict"
import { product_paths } from "#root/src/settings/layout.js"

const root = file_url_to_path(new URL("../../../", import.meta.url))
const control = join(root, "tools", "control")
const host = join(root, "server", "host")
const { host: host_source, control: control_source } = product_paths()

const files = async (dir) => {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "__pycache__", "term", "chat"].includes(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await files(path))
    else if (entry.isFile()) found.push(path)
  }
  return found
}

/** Follow the actual source imports, including shared files outside server/host/. */
const trace = async (path, forbidden, standard_only = false, seen = new Set()) => {
  if (seen.has(path)) return
  seen.add(path)
  const forbidden_roots = Array.isArray(forbidden) ? forbidden : [forbidden]
  assert.ok(!forbidden_roots.some(folder => path.startsWith(folder + sep)), `${relative(root, path)} crosses the runtime boundary`)
  const source = await read_file(path, "utf8")
  const require = create_require(path)
  for (const [, specifier] of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\(\s*)["']([^"']+)["']/g)) {
    if (specifier.startsWith("node:")) continue
    const local = specifier.startsWith(".") || specifier.startsWith("#root/")
    if (standard_only) assert.ok(local, `${relative(root, path)} imports external runtime code: ${specifier}`)
    if (local) await trace(require.resolve(specifier), forbidden, standard_only, seen)
  }
}

test("the host does not know the control plane exists", async () => {
  const offences = []
  for (const path of [...await files(host), ...await files(host_source)]) {
    const source = await read_file(path, "utf8")
    for (const line of source.split("\n")) {
      const code = line.trim()
      if (/^(\*|\/\/|#)/.test(code)) continue
      if (/\bcontrol\/|\bnode_modules\b|\bnpm\b|\brequire\(/.test(code)) offences.push(`${relative(root, path)}: ${code}`)
    }
  }
  assert.deepEqual(offences, [])
})

test("the host and its shared imports use only the standard library", async () => {
  await trace(join(host, "main.js"), [control, control_source], true)
  for (const path of await files(join(host, "clients"))) {
    if (path.endsWith(".js")) await trace(path, [control, control_source], true)
  }
})

test("the control plane reaches actors only over HTTP", async () => {
  await trace(join(control, "bin/webspace.js"), [host, host_source])
})

test("both runtime boundaries hold code", async () => {
  assert.ok((await files(control)).some(path => path.endsWith(".js")))
  assert.ok((await files(host_source)).some(path => path.endsWith("/actors.js")))
})
