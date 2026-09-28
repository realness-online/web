// What an app needs, read from its own files. Nothing is attached that the
// files do not ask for: a runtime disk only for the language found, a port only
// when there is a server. Rules, first match wins:
//
//   Procfile `web:` line   its command; the runtime is the command's first word
//   package.json           node: scripts.start if it is plain `node ...`, else
//                          main, else server.js / index.js
//   *.py entry             python: main.py, app.py, server.py
//   one ELF executable     no runtime: the binary runs as is
//   index.html             a static site: files only, no VM
//
// A server listens on $PORT (always 8080 inside its VM; each VM has its own
// address, so every app can use the same number).

import { existsSync, openSync, readSync, closeSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

export const APP_PORT = 8080

const RUNTIME_OF = { node: "node", python3: "python", python: "python" }
const NODE_ENTRIES = ["server.js", "index.js", "app.js", "main.js"]
const PYTHON_ENTRIES = ["main.py", "app.py", "server.py"]
const SHELL = /[|&;<>$`\\"'*?(){}[\]~]/

export class InferError extends Error {}

const server = (runtime, start) => ({ kind: runtime ?? "binary", runtime, start, port: APP_PORT })

function argv(command, where) {
  if (SHELL.test(command)) throw new InferError(`${where}: '${command}' needs a shell; put it in a script and run that`)
  return command.trim().split(/\s+/)
}

function fromProcfile(dir) {
  const path = join(dir, "Procfile")
  if (!existsSync(path)) return null
  const line = readFileSync(path, "utf8").split("\n").find((l) => /^web:/.test(l))
  if (!line) throw new InferError("Procfile has no web: line")
  const start = argv(line.slice(4), "Procfile")
  if (start[0].startsWith("./")) return server(null, start)
  const runtime = RUNTIME_OF[start[0]]
  if (!runtime) throw new InferError(`Procfile runs '${start[0]}'; known runtimes are node and python3`)
  return server(runtime, start)
}

function fromPackage(dir) {
  const path = join(dir, "package.json")
  if (!existsSync(path)) return null
  let pkg
  try {
    pkg = JSON.parse(readFileSync(path, "utf8"))
  } catch (error) {
    throw new InferError(`package.json: ${error.message}`)
  }
  const script = pkg.scripts?.start
  if (script && /^node\s/.test(script)) return server("node", argv(script, "scripts.start"))
  const entry = [pkg.main, ...NODE_ENTRIES].find((file) => file && existsSync(join(dir, file)))
  if (entry) return server("node", ["node", entry])
  if (script) throw new InferError(`scripts.start is '${script}'; start with plain 'node <file>' or add a Procfile`)
  return null // a package.json with no server: likely a site's build tooling
}

function fromPython(dir) {
  const entry = PYTHON_ENTRIES.find((file) => existsSync(join(dir, file)))
  return entry ? server("python", ["python3", entry]) : null
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

function fromBinary(dir) {
  const bins = readdirSync(dir).filter((name) => {
    const path = join(dir, name)
    const stat = statSync(path)
    return stat.isFile() && stat.mode & 0o111 && isElf(path)
  })
  if (bins.length > 1) throw new InferError(`several executables (${bins.join(", ")}); add a Procfile naming one`)
  return bins.length ? server(null, [`./${bins[0]}`]) : null
}

/** What `dir` needs to run: {kind, runtime, start, port}. Throws InferError when it cannot say. */
export function infer(dir) {
  const found = fromProcfile(dir) ?? fromPackage(dir) ?? fromPython(dir) ?? fromBinary(dir)
  if (found) return found
  if (existsSync(join(dir, "index.html"))) return { kind: "site", runtime: null, start: null, port: null }
  throw new InferError("no server found (package.json, main.py, an executable, or a Procfile) and no index.html")
}
