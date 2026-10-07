/**
 * The sync service over HTTP. Every request: phone token, then `can()`,
 * then storage, then one log line with phone numbers hashed.
 *
 *   GET    /people/+A/posters/     list a folder (trailing slash)
 *   GET    /people/+A/vault/?deep  every file below, name to version
 *   GET    /people/+A/index.html.gz
 *   PUT    /people/+A/vault/note.md   If-Match: "<version>" or If-None-Match: *
 *   DELETE /people/+A/vault/note.md   If-Match optional
 *
 * No token is a stranger; a bad token is 401. Denial is 403 whether or not
 * the file exists, because the check runs before storage is touched.
 *
 * Browsers may call it only from `origins`, the sites allowed to read and write.
 */
import { createHash as create_hash, timingSafeEqual as timing_safe_equal } from "node:crypto"
import { createServer as create_server } from "node:http"
import { can, identify } from "#root/lib/can/src/index.js"
import { issue_host_pass, verify_host_pass, verify_record_pass, record_host } from "#root/lib/sign-on/src/node/host-pass.js"
import { run_host_alerts } from "./host-alerts.js"
import { host_health } from "./host-watch.js"
import { site_request } from "./sites.js"
import { read_changes, record_change } from "./changes.js"
import { harness_path, recovery_path, verify_harness_pass, verify_recovery_pass } from "#root/lib/sign-on/src/node/recovery-pass.js"
import { rights_key } from "./rights.js"
import { admins as admin_list } from "./admins.js"

const LIMIT = 10 * 1024 * 1024
const PHONES = /\+[1-9]\d{6,14}/g

/** Logs hash numbers and never store them raw. */
export const hash_phones = (text) =>
  text.replace(PHONES, (phone) => `#${create_hash("sha256").update(phone).digest("hex").slice(0, 12)}`)

/**
 * Pins live at `pins/+A`, written once; `can()` denies that root to everyone.
 * A pin never changes once written, so each is read from storage only once.
 */
export const storage_pins = (storage) => {
  const known = new Map()
  return {
    async claim(phone, uid) {
      if (known.has(phone)) return known.get(phone)
      let pinned = uid
      try {
        await storage.put(`pins/${phone}`, uid, { if_version: null })
      } catch (error) {
        if (error.code !== "conflict") throw error
        pinned = (await storage.get(`pins/${phone}`))?.body.toString("utf8")
      }
      if (pinned) known.set(phone, pinned)
      return pinned
    },
  }
}

class Status extends Error {
  constructor(status) {
    super(String(status))
    this.status = status
  }
}

const action_for = (method, path) =>
  ({ GET: path.endsWith("/") || path === "" ? "list" : "get", PUT: "write", DELETE: "delete" })[method]

const version_from = (value) => value?.replace(/^W\//, "").replace(/^"|"$/g, "")

const read_body = async (request) => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > LIMIT) throw new Status(413)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const PREFLIGHT = {
  "access-control-allow-methods": "GET, PUT, DELETE, POST",
  "access-control-allow-headers": "authorization, content-type, if-match, if-none-match",
  "access-control-max-age": "600",
}

export const sync_service = ({ storage, rights, project, certs, host_pass_secret, alert_token = null, alert_webhook = null, origins = [], log = console.log }) => {
  const pins = storage_pins(storage)
  const allowed = new Set(origins)

  /** Cloud Scheduler presents a shared secret; nothing else calls this. */
  const alert_call = (request) => {
    if (!alert_token) return false
    const given = Buffer.from(/^Bearer (\S+)$/.exec(request.headers.authorization ?? "")?.[1] ?? "")
    const wanted = Buffer.from(alert_token)
    return given.length === wanted.length && timing_safe_equal(given, wanted)
  }

  const who_is = async (request) => {
    const header = request.headers.authorization
    if (!header) return null
    const token = /^Bearer (\S+)$/.exec(header)?.[1]
    if (!token) throw new Status(401)
    if (token.split(".").length === 2) {
      if (!host_pass_secret) throw new Status(401)
      try {
        const claims = verify_recovery_pass(token, host_pass_secret)
        return { recovery: claims.phone, id: claims.id, paths: claims.paths }
      } catch {
        try {
          const claims = verify_harness_pass(token, host_pass_secret)
          return { harness: claims.phone, id: claims.id, paths: claims.paths }
        } catch {
          try { return { ...verify_host_pass(token, host_pass_secret), host: true } }
          catch {
            try {
              const host = record_host(token)
              const key = await storage.get(`host-keys/${host}`)
              if (!key) throw new Status(401)
              return { host_name: verify_record_pass(token, key.body.toString("utf8").trim()).host }
            } catch { throw new Status(401) }
          }
        }
      }
    }
    try {
      return await identify(token, { project, certs, pins })
    } catch {
      throw new Status(401)
    }
  }

  const admins = admin_list(storage)

  const handle = async (request, response, path, action, who) => {
    // Admin is asked only where it grants something: loops, hosts, and the ledger.
    if (["loops", "hosts", "usage", "billing"].includes(path.split("/")[0]) && who?.phone) who = { ...who, admin: await admins.has(who.phone) }
    const owner = path.split("/")[1]
    const grants = who?.instance && owner ? (await rights.grants(owner)).grants : []
    if (who?.harness) {
      if (!harness_path(path, who.harness, who.paths)) throw new Status(403)
    } else if (who?.recovery) {
      if (!["get", "list"].includes(action) || !recovery_path(path, who.recovery, who.paths)) throw new Status(403)
    } else if (who?.host) {
      if (!path.startsWith(`people/${who.phone}/work/site/`) || !can(who, action, path, grants)) throw new Status(403)
    } else if (!can(who, action, path, grants)) throw new Status(403)

    if (action === "list") {
      const query = new URLSearchParams((request.url ?? "").split("?")[1] ?? "")
      // h3: `?changes=<cursor>` answers what moved since; an empty cursor starts one.
      if (query.has("changes")) {
        const feed = await read_changes(storage, path, query.get("changes"))
        if (!feed) throw new Status(410)
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
        return response.end(JSON.stringify(feed))
      }
      response.writeHead(200, { "content-type": "application/json" })
      return response.end(JSON.stringify(await (query.has("deep") ? storage.walk(path) : storage.list(path))))
    }
    if (action === "get") {
      const file = await storage.get(path)
      if (!file) throw new Status(404)
      response.writeHead(200, { etag: `"${file.version}"`, "content-type": "application/octet-stream" })
      return response.end(file.body)
    }

    const if_version =
      request.headers["if-none-match"] === "*" ? null : version_from(request.headers["if-match"])
    try {
      if (action === "write") {
        const version = await storage.put(path, await read_body(request), { if_version })
        await record_change(storage, path, version)
        response.writeHead(200, { etag: `"${version}"` })
      } else {
        await storage.delete(path, { if_version })
        await record_change(storage, path, null)
        response.writeHead(204)
      }
    } catch (error) {
      if (error.code === "conflict") throw new Status(412)
      throw error
    }
    if (owner && path === rights_key(owner)) rights.forget(owner)
    response.end()
  }

  return create_server(async (request, response) => {
    const started = Date.now()
    // Decode once; `can()` refuses remaining percent escapes, not plain `%`.
    let path = (request.url ?? "/").split("?")[0].slice(1)
    try {
      path = decodeURIComponent(path)
    } catch {
      path = null
    }
    const origin = request.headers.origin
    let who = null
    let status = 200
    if (origin && allowed.has(origin)) {
      response.setHeader("access-control-allow-origin", origin)
      response.setHeader("access-control-expose-headers", "etag")
    }
    response.setHeader("vary", "origin")
    try {
      if (request.method === "OPTIONS") {
        if (!origin || !allowed.has(origin)) throw new Status(403)
        response.writeHead((status = 204), PREFLIGHT).end()
        return
      }
      if (path === null) throw new Status(400)
      if (path.startsWith("sites/") || path.startsWith("v1/sites/")) {
        if (path.startsWith("v1/sites/")) {
          const pass = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "")?.[1]
          if (!pass || !host_pass_secret) throw new Status(401)
          try { who = verify_host_pass(pass, host_pass_secret) }
          catch { throw new Status(401) }
        }
        await site_request({ storage, method: request.method, path, who, response, read_body: () => read_body(request) })
      } else if (path === "v1/host-watch/run" && request.method === "POST") {
        // m8: the alert clock is outside sync, which sleeps at zero usage.
        if (!alert_call(request)) throw new Status(401)
        const sent = await run_host_alerts({ storage, webhook: alert_webhook, warn: (message) => log(hash_phones(message)) })
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
        response.end(JSON.stringify({ sent }))
      } else if (path === "hosts/quiet.json" && request.method === "GET") {
        // m7: a derived answer, admin-only. Nothing is stored for it.
        who = await who_is(request)
        if (!who?.phone) throw new Status(401)
        if (!(await admins.has(who.phone))) throw new Status(403)
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
        response.end(JSON.stringify(await host_health(storage)))
      } else if (path === "v1/host-pass" && request.method === "POST") {
        who = await who_is(request)
        if (!who?.phone) throw new Status(401)
        if (!host_pass_secret) throw new Status(503)
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
        response.end(JSON.stringify({ pass: issue_host_pass(who, host_pass_secret), expires_in: 300 }))
      } else {
        // e3: browsers reach records through the app address under /v1/.
        const record = path.startsWith("v1/") ? path.slice(3) : path
        const action = action_for(request.method, record)
        if (!action) throw new Status(405)
        who = await who_is(request)
        await handle(request, response, record, action, who)
      }
      status = response.statusCode
    } catch (error) {
      status = Number.isInteger(error.status) ? error.status : 500
      if (status === 500) log(hash_phones(`error ${error.stack ?? error}`))
      // Uncached: Hosting would keep a 404 for ten minutes, hiding a site published moments later.
      if (!response.headersSent) response.writeHead(status, { "cache-control": "no-store" }).end()
      else response.destroy()
    } finally {
      const line = `${new Date().toISOString()} ${who?.phone ?? "-"} ${request.method} /${path ?? "(bad encoding)"} ${status} ${Date.now() - started}ms`
      log(hash_phones(line))
    }
  })
}
