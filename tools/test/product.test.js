import { readFile as read_file, readdir, access } from "node:fs/promises"
import { join, relative } from "node:path"
import { createRequire as create_require } from "node:module"
import { fileURLToPath as file_url_to_path } from "node:url"
import { execFile as exec_file } from "node:child_process"
import { promisify } from "node:util"
import { test } from "node:test"
import assert from "node:assert/strict"
import { engine } from "#root/tools/publish/src/view.js"

const root = file_url_to_path(new URL("../../", import.meta.url))
const run = promisify(exec_file)
const folders = ["lib", "server", "tools"]
// Starter examples keep portable manifests; chat is product code.
const starter = (path) => /\/tools\/examples\/(static|app)\//.test(path)

const files = async (dir) => {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "term", "chat", ".git"].includes(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await files(path))
    else if (entry.isFile()) found.push(path)
  }
  return found
}

test("the product has one package manifest and no workspaces", async () => {
  const manifest = JSON.parse(await read_file(join(root, "package.json"), "utf8"))
  assert.equal(manifest.name, "brayness")
  assert.equal(manifest.workspaces, undefined)
  for (const folder of folders) {
    assert.deepEqual((await files(join(root, folder))).filter(path => path.endsWith("/package.json") && !starter(path)), [])
  }
  await assert.rejects(access(join(root, "out")), { code: "ENOENT" })
})

test("product imports resolve through the root instead of retired packages", async () => {
  const offences = []
  for (const folder of folders) {
    for (const path of await files(join(root, folder))) {
      if (!path.endsWith(".js")) continue
      const source = await read_file(path, "utf8")
      const require = create_require(path)
      for (const [, specifier] of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\(\s*)["']([^"']+)["']/g)) {
        if (/^brayness-(can|out|sync|proxy|host|publish|cli)(\/|$)/.test(specifier)) offences.push(`${relative(root, path)} still imports ${specifier}`)
        if (specifier.startsWith("#root/")) {
          try {
            require.resolve(specifier)
          } catch (error) {
            offences.push(`${relative(root, path)} cannot resolve ${specifier}: ${error.code}`)
          }
        }
      }
    }
  }
  assert.deepEqual(offences, [])
})

test("the reference renderer reuses dependencies from the root install", async () => {
  const directory = join(root, "tools/publish/renderer")
  const manifest = JSON.parse(await read_file(join(root, "tools/examples/static/package.json"), "utf8"))
  const require = create_require(join(root, "package.json"))
  for (const name of Object.keys(manifest.dependencies)) {
    assert.ok(require.resolve(name).startsWith(join(root, "node_modules")), `${name} needs another install`)
  }
  assert.equal(await engine(root), directory)
  await assert.rejects(access(join(directory, "package.json")), { code: "ENOENT" })
  await assert.rejects(access(join(directory, "node_modules")), { code: "ENOENT" })
})

test("browser conditions cannot resolve the secret-bearing Node sign-on entries", async () => {
  for (const specifier of ["brayness/sign-on/login", "brayness/sign-on/host-pass"]) {
    await assert.rejects(run(process.execPath, ["--conditions=browser", "--input-type=module", "-e", `import ${JSON.stringify(specifier)}`], { cwd: root }), /ERR_PACKAGE_PATH_NOT_EXPORTED/)
  }
})
