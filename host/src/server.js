// The HTTP API: sessions over the host's network. Routes and error shapes are
// the contract in control/test/host.check.js.
//
// Errors are JSON: 400 malformed, 404 unknown session or route, 500 with the
// host or Firecracker message, which is where the fix usually is.

import { readFileSync, realpathSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, sep } from "node:path"
import { BadRequest, HOST_FAILURES, NotFound } from "./errors.js"
import { logger } from "./log.js"

const LOG = logger("server")
// The longest exec a caller may ask for: an npm install on two vCPUs is minutes.
const EXEC_TIMEOUT_MAX = 1800

export const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
}

function send(response, status, headers, body) {
  response.writeHead(status, { ...headers, "content-length": body.length })
  response.end(body)
}

function json(response, status, payload) {
  if (status === 204) return send(response, 204, {}, Buffer.alloc(0))
  send(response, status, { "content-type": "application/json" }, Buffer.from(`${JSON.stringify(payload, null, 2)}\n`))
}

const plain = (response, status, message) => send(response, status, { "content-type": "text/plain; charset=utf-8" }, Buffer.from(`${message}\n`))

function readBody(request) {
  return new Promise((done, fail) => {
    const chunks = []
    request.on("data", (chunk) => chunks.push(chunk))
    request.on("end", () => done(Buffer.concat(chunks)))
    request.on("error", fail)
  })
}

/** The body as a JSON object; an empty body is {}. */
async function readJson(request) {
  const raw = await readBody(request)
  if (!raw.length) return {}
  let payload
  try {
    payload = JSON.parse(raw)
  } catch (error) {
    throw new BadRequest(`body is not JSON: ${error.message}`)
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) throw new BadRequest("body must be a JSON object")
  return payload
}

/** A file from a published tree. A directory serves index.html; a bare name its .html. */
function site(store, response, id, rel) {
  const root = store.publishedSite(id)
  if (!root) return plain(response, 404, `nothing published for ${id}`)
  const realRoot = realpathSync(root)
  const inside = (path) => path === realRoot || path.startsWith(realRoot + sep)
  const is = (path, kind) => {
    try {
      return statSync(path)[kind]()
    } catch {
      return false
    }
  }
  let target
  try {
    target = join(realRoot, decodeURIComponent(rel))
  } catch {
    return plain(response, 400, "bad path encoding")
  }
  if (!inside(target)) return plain(response, 403, "that path leaves the published site")
  if (is(target, "isDirectory")) target = join(target, "index.html")
  else if (!is(target, "isFile") && is(`${target}.html`, "isFile")) target = `${target}.html`
  if (!is(target, "isFile")) return plain(response, 404, `no ${rel} in ${id}`)
  if (!inside(realpathSync(target))) return plain(response, 403, "that path leaves the published site")
  send(response, 200, { "content-type": CONTENT_TYPES[extname(target).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" }, readFileSync(target))
}

function health(store) {
  const seed = store.seedStatus()
  const counts = {}
  for (const record of store.list()) counts[record.state] = (counts[record.state] ?? 0) + 1
  return {
    ok: true,
    seed: {
      built: seed.built,
      matches: seed.matches,
      mismatches: seed.mismatches,
      machine_id: seed.record?.machine_id ?? null,
      boot_id: seed.record?.boot_id ?? null,
      created: seed.record?.created ?? null,
    },
    sessions: counts,
  }
}

async function exec(store, request, id) {
  const payload = await readJson(request)
  const stdinB64 = payload.stdin_b64 || ""
  if (typeof stdinB64 !== "string") throw new BadRequest("stdin_b64 must be a base64 string")
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(stdinB64) || stdinB64.length % 4) throw new BadRequest("stdin_b64 is not base64")
  // Without a caller's timeout a long command outlived the caller's wait.
  const timeout = payload.timeout ?? null
  if (timeout !== null && (typeof timeout !== "number" || !(timeout > 0 && timeout <= EXEC_TIMEOUT_MAX))) {
    throw new BadRequest(`timeout must be seconds, 0 < t <= ${EXEC_TIMEOUT_MAX}`)
  }
  return store.exec(id, payload.argv, { cwd: payload.cwd ?? null, stdin: Buffer.from(stdinB64, "base64"), timeout })
}

async function route(store, request, response) {
  const url = new URL(request.url, "http://host")
  const path = url.pathname.replace(/\/+$/, "") || "/"
  const method = request.method

  // <id>.localhost gives a published site its own root, so root-relative links resolve.
  const [label, ...rest] = (request.headers.host ?? "").split(":")[0].split(".")
  if (method === "GET" && rest.join(".") === "localhost" && label.startsWith("s-")) {
    return site(store, response, label, url.pathname.replace(/^\/+/, ""))
  }

  if (method === "GET") {
    if (path === "/v1/health") return json(response, 200, health(store))
    if (path === "/v1/sessions") return json(response, 200, { sessions: store.list() })
    if (path === "/v1/exports") return json(response, 200, { exports: store.exports() })
    if (url.pathname.startsWith("/s/")) {
      const [id, ...parts] = url.pathname.slice(3).split("/")
      return site(store, response, id, parts.join("/"))
    }
    if (path.startsWith("/v1/sessions/")) {
      const [id, action] = path.slice("/v1/sessions/".length).split("/")
      if (action === "trace") return json(response, 200, { events: store.traceOf(id) })
      if (action === undefined) return json(response, 200, store.get(id))
    }
  }

  if (method === "POST") {
    if (path === "/v1/sessions") {
      const payload = await readJson(request)
      if (payload.restore_from === undefined || payload.restore_from === null) return json(response, 201, await store.create())
      if (typeof payload.restore_from !== "string" || !payload.restore_from) throw new BadRequest("restore_from must be an export id")
      return json(response, 201, await store.restore(payload.restore_from))
    }
    if (path.startsWith("/v1/sessions/")) {
      const [id, action] = path.slice("/v1/sessions/".length).split("/")
      if (action === "exec") return json(response, 200, await exec(store, request, id))
      if (action === "idle") {
        const payload = await readJson(request)
        const tier = payload.tier || "memory"
        if (typeof tier !== "string") throw new BadRequest("tier must be a string")
        return json(response, 200, await store.idle(id, tier))
      }
      if (action === "reload") return json(response, 200, await store.reload(id))
      if (action === "export") return json(response, 200, await store.export(id))
      if (action === "publish") {
        const payload = await readJson(request)
        const tree = payload.path ?? "/root/site"
        if (typeof tree !== "string") throw new BadRequest("path must be a string")
        return json(response, 200, await store.publish(id, tree || "/root/site"))
      }
    }
  }

  if (method === "DELETE" && path.startsWith("/v1/sessions/")) {
    await store.destroy(path.split("/").at(-1))
    return json(response, 204)
  }

  request.resume()
  json(response, 404, { error: `no route for ${method} ${path}` })
}

export function makeServer(store) {
  return createServer(async (request, response) => {
    try {
      await route(store, request, response)
    } catch (error) {
      request.resume()
      if (error instanceof BadRequest) return json(response, 400, { error: error.message })
      if (error instanceof NotFound) return json(response, 404, { error: "no such session" })
      if (HOST_FAILURES.some((kind) => error instanceof kind)) {
        LOG.warn(`request failed: ${error.message}`)
        return json(response, 500, { error: error.message })
      }
      LOG.error("request failed", error)
      json(response, 500, { error: `${error.name}: ${error.message}` })
    }
  })
}
