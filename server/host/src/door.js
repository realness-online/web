// The door: requests an actor makes of its host, over guest-initiated vsock.
//
// A guest connecting to CID 2 port 54 reaches `<actor>/vsock.sock_54` on the
// host. Only that VM can open it, so the socket is the actor's identity.
//
//   {"op": "publish", "path": "/brayness/site"}  ->  {"ok": true, "url": "..."}
//   {"op": "loop", "goal": "..."}                ->  {"ok": true, "id": "a-...", "depth": 1}
//   {"op": "loop-report", "id": "a-..."}         ->  {"ok": true, "loop": {status, runs, tail, ...}}
//
// One listener per running actor, kept in step by a reconciler rather than
// hooks in every start, reload, and destroy path.

import { existsSync as exists_sync, rmSync as rm_sync } from "node:fs"
import { createServer as create_server } from "node:net"
import { logger } from "./log.js"
import { Loops } from "./loops.js"
import { Lines } from "./vsock.js"
import { can } from "#root/lib/can/src/can.js"
import { issue_harness_pass, issue_recovery_pass } from "#root/lib/sign-on/src/node/recovery-pass.js"
import { issue_model_pass } from "#root/server/proxy/src/model-pass.js"

const LOG = logger("door")
const DOOR_PORT = 54
const LINE_LIMIT = 1 << 16
const RECONCILE_MS = 500
const LOOP_WATCH_MS = 30_000

/** The guest's door socket for an actor; listening once the reconciler has run for it. */
export const door_path = (vsock_path) => `${vsock_path}_${DOOR_PORT}`

/** Resolves true once the actor's door is listening; false after `timeout_ms`. */
export const wait_for_door = async (vsock_path, { timeout_ms = 5000, every_ms = 100 } = {}) => {
  const ends = Date.now() + timeout_ms
  while (!exists_sync(door_path(vsock_path))) {
    if (Date.now() >= ends) return false
    await new Promise((done) => setTimeout(done, every_ms))
  }
  return true
}

export class Door {
  constructor(store, siteUrl = "/s/{id}/", loops = null) {
    this.store = store
    this.siteUrl = siteUrl
    this.loops = loops
    this.listeners = new Map() // actor id -> { path, server }
  }

  start() {
    this.#watchLoops()
    const tick = () => {
      try {
        this.reconcile()
      } catch (error) {
        LOG.error("door reconcile failed", error) // one bad pass must not end the door
      }
      this.timer = setTimeout(tick, RECONCILE_MS)
    }
    tick()
  }

  #watchLoops() {
    const tick = async () => {
      try {
        for (const { id, reason } of await (this.loops ??= new Loops(this.store)).watch()) LOG.info(`loop ${id} stopped: ${reason}`)
      } catch (error) {
        LOG.error("loop watch failed", error)
      }
      this.loopTimer = setTimeout(tick, LOOP_WATCH_MS)
    }
    this.loopTimer = setTimeout(tick, LOOP_WATCH_MS)
  }

  reconcile() {
    const live = new Map(this.store.liveActors().map((record) => [record.id, record]))
    for (const [id, { path, server }] of this.listeners) {
      if (!live.has(id) || !exists_sync(path)) {
        server.close()
        this.listeners.delete(id)
      }
    }
    for (const [id, record] of live) if (!this.listeners.has(id)) this.#listen(record)
  }

  #listen(record) {
    const path = door_path(record.vsockPath)
    rm_sync(path, { force: true })
    const server = create_server((conn) => this.#handle(record.id, conn))
    server.on("error", (error) => LOG.warn(`door for ${record.id}: ${error.message}`))
    server.listen(path)
    this.listeners.set(record.id, { path, server })
  }

  async #handle(id, conn) {
    let reply
    try {
      const line = await new Lines(conn, LINE_LIMIT).read(10)
      if (line && line.length >= LINE_LIMIT) throw new Error("request line is too long")
      reply = await this.#answer(id, JSON.parse(line?.length ? line : "{}"))
    } catch (error) {
      if (!(error instanceof SyntaxError) && error.name !== "BadRequest") LOG.warn(`door request from ${id} failed: ${error.message}`)
      reply = { ok: false, error: error.message }
    }
    conn.end(`${JSON.stringify(reply)}\n`)
  }

  async #answer(id, request) {
    const record = this.store.get(id)
    const owner = record.owner
    const instance = `/${owner}/harnesses/${id}`
    if (request.op === "recovery-pass") {
      if (!owner || !can({ instance }, "get", `people/${owner}/harnesses/${id}`)) throw new Error("actor cannot recover")
      return { ok: true, pass: issue_recovery_pass({ phone: owner, id, paths: record.paths ?? null }, process.env.HOST_PASS_SECRET) }
    }
    if (request.op === "harness-pass") {
      if (!owner || !can({ instance }, "get", `people/${owner}/harnesses/${id}`)) throw new Error("actor cannot sync")
      return { ok: true, pass: issue_harness_pass({ phone: owner, id, paths: record.paths ?? null }, process.env.HOST_PASS_SECRET) }
    }
    if (request.op === "model-pass") {
      if (!owner || !can({ instance }, "get", `people/${owner}/harnesses/${id}`)) throw new Error("actor cannot call models")
      return { ok: true, pass: issue_model_pass({ phone: owner, id }, process.env.MODEL_PASS_SECRET) }
    }
    if (request.op === "loop-report") {
      if (!owner || !can({ instance }, "get", `people/${owner}/harnesses/${id}`)) throw new Error("actor cannot read loops")
      return { ok: true, loop: (this.loops ??= new Loops(this.store)).report(id, request.id) }
    }
    if (request.op === "loop") {
      if (!owner || !can({ instance }, "get", `people/${owner}/harnesses/${id}`)) throw new Error("actor cannot start loops")
      const loop = await (this.loops ??= new Loops(this.store)).start(id, request.goal)
      LOG.info(`door: ${id} started loop ${loop.id} at depth ${loop.depth}`)
      return { ok: true, ...loop }
    }
    const site = request.site ?? id
    if (!this.store.syncSites && site !== id) throw new Error("site belongs to another actor; sync sites are not configured")
    if (request.op === "site-versions") {
      if (!owner || !can({ instance }, "get", `people/${owner}/harnesses/${id}/site`)) throw new Error("actor cannot read site versions")
      return { ok: true, versions: await this.store.siteVersions(id, site) }
    }
    if (request.op === "site-restore" || request.op === "site-remove") {
      if (!owner || !can({ instance }, "write", `people/${owner}/harnesses/${id}/site`)) throw new Error("actor cannot manage site")
      const result = request.op === "site-restore" ? await this.store.restoreSite(id, request.version, site) : await this.store.unpublishSite(id, site)
      return { ok: true, ...result, url: this.siteUrl.replaceAll("{id}", site) }
    }
    if (request.op !== "publish") throw new Error(`unknown op '${request.op}'`)
    if (!owner || !can({ instance }, "write", `people/${owner}/harnesses/${id}/site`)) throw new Error("actor cannot publish")
    const path = request.path || "/brayness/site"
    await this.store.publish(id, path, site)
    LOG.info(`door: ${id} published ${path}`)
    return { ok: true, site, url: this.siteUrl.replaceAll("{id}", site) }
  }
}
