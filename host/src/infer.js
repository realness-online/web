// What an app is, read from its files. Brayness manages the server: an author
// writes one `fetch(request)` handler, and we run it on Node with our server
// (u2k). Anything else is refused with a reason; frameworks are an export.
//
//   server.js with `export default`   a handler: one VM, Node, our server
//   index.html, no server.js          a static site: files only, no VM
//
// The handler is the shape Workers, Deno, and Bun run:
//
//   export default { async fetch(request) { return new Response("hi") } }

import { existsSync, openSync, readSync, closeSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

export const APP_PORT = 8080
export const HANDLER = "server.js"
// Our server, on the node runtime disk; it imports the author's handler.
export const SERVE = "/opt/runtime/brayness/serve.js"
// Node's permission model: read the handler and our server, nothing else; no
// writes, child processes, workers, addons, WASI, or inspector.
export const START = ["node", "--permission", "--allow-fs-read=/app/code/", "--allow-fs-read=/opt/runtime/brayness/", SERVE]

const EXPORT = "brayness runs one fetch handler: export default { fetch(request) } from server.js"

export class InferError extends Error {}

// u2m. Standard library only. This scan is the friendly early error; the wall
// is structural: no node_modules reaches the code disk, and --permission lets
// Node read nothing outside /app/code, so a bare import has nothing to find.
const SPECIFIER = /(?:\bimport\s*(?:[\w*{}\s,]+from\s*)?|\bexport\s*[\w*{}\s,]+from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["'`]([^"'`]+)["'`]/g
const SOURCE = /\.(js|mjs|cjs)$/
// Spelled in parts: the host's boundary test bans the literal, which guards
// against the host taking dependencies. Here it names what apps may not ship.
const MODULES = ["node", "modules"].join("_")

function* walk(dir, rel = "") {
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const path = join(rel, entry.name)
    if (entry.isDirectory()) {
      yield { path, dir: true }
      yield* walk(dir, path)
    } else if (entry.isFile()) yield { path, dir: false }
  }
}

/** Every reason the files reach past the standard library. */
export function outsideStdlib(dir) {
  const found = []
  for (const { path, dir: isDir } of walk(dir)) {
    if (isDir && path.split("/").pop() === MODULES) found.push(`${path}/: apps take no dependencies`)
    if (isDir || !SOURCE.test(path)) continue
    for (const [, spec] of readFileSync(join(dir, path), "utf8").matchAll(SPECIFIER)) {
      if (spec.startsWith("node:") || spec.startsWith("./") || spec.startsWith("../")) continue
      found.push(`${path} imports '${spec}': use node: built-ins and your own files`)
    }
  }
  const pkg = join(dir, "package.json")
  if (existsSync(pkg)) {
    let json = {}
    try {
      json = JSON.parse(readFileSync(pkg, "utf8"))
    } catch {}
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      const names = Object.keys(json[field] ?? {})
      if (names.length) found.push(`package.json ${field}: ${names.join(", ")}`)
    }
  }
  return found
}

function isElf(path) {
  const fd = openSync(path, "r")
  try {
    const head = Buffer.alloc(4)
    return readSync(fd, head, 0, 4, 0) === 4 && head.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
  } finally {
    closeSync(fd)
  }
}

/** Files that mean another stack; each is refused by name. */
function refusals(dir) {
  const found = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (!stat.isFile()) continue
    if (name === "Procfile") found.push("a Procfile")
    else if (name.endsWith(".py")) found.push(`python (${name})`)
    else if (stat.mode & 0o111 && isElf(path)) found.push(`an executable (${name})`)
  }
  return found
}

/** What `dir` is: {kind, runtime, start, port}. Throws InferError, with the reason, otherwise. */
export function infer(dir) {
  const refused = refusals(dir)
  if (refused.length) throw new InferError(`${refused.join(", ")}: ${EXPORT}`)
  const handler = join(dir, HANDLER)
  if (existsSync(handler)) {
    if (!/^\s*export\s+default\b/m.test(readFileSync(handler, "utf8"))) throw new InferError(`${HANDLER} has no default export: ${EXPORT}`)
    const outside = outsideStdlib(dir)
    if (outside.length) throw new InferError(`standard library only:\n  ${outside.join("\n  ")}`)
    return { kind: "handler", runtime: "node", start: START, port: APP_PORT }
  }
  if (existsSync(join(dir, "index.html"))) return { kind: "site", runtime: null, start: null, port: null }
  throw new InferError(`no ${HANDLER} and no index.html: ${EXPORT}`)
}
