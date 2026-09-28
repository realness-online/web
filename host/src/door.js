// The door: requests an actor makes of its host, over guest-initiated vsock.
//
// A guest connecting to CID 2 port 54 reaches `<actor>/vsock.sock_54` on the
// host. Only that VM can open it, so the socket is the actor's identity.
//
//   {"op": "publish", "path": "/brayness/site"}  ->  {"ok": true, "url": "..."}
//
// One listener per running actor, kept in step by a reconciler rather than
// hooks in every start, reload, and destroy path.

import { existsSync, rmSync } from "node:fs"
import { createServer } from "node:net"
import { logger } from "./log.js"
import { Lines } from "./vsock.js"
import { can } from "../../can/src/can.js"
import { issue_recovery_pass } from "../../sync/src/recovery-pass.js"
import { issue_model_pass } from "../../proxy/src/model-pass.js"

const LOG = logger("door")
const DOOR_PORT = 54
const LINE_LIMIT = 1 << 16
const RECONCILE_MS = 500

export class Door {
  constructor(store, siteUrl = "/s/{id}/") {
    this.store = store
    this.siteUrl = siteUrl
    this.listeners = new Map() // actor id -> { path, server }
  }

  start() {
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

  reconcile() {
    const live = new Map(this.store.liveActors().map((record) => [record.id, record]))
    for (const [id, { path, server }] of this.listeners) {
      if (!live.has(id) || !existsSync(path)) {
        server.close()
        this.listeners.delete(id)
      }
    }
    for (const [id, record] of live) if (!this.listeners.has(id)) this.#listen(record)
  }

  #listen(record) {
    const path = `${record.vsockPath}_${DOOR_PORT}`
    rmSync(path, { force: true })
    const server = createServer((conn) => this.#handle(record.id, conn))
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
    if (request.op === "model-pass") {
      if (!owner || !can({ instance }, "get", `people/${owner}/harnesses/${id}`)) throw new Error("actor cannot call models")
      return { ok: true, pass: issue_model_pass({ phone: owner, id }, process.env.MODEL_PASS_SECRET) }
    }
    if (request.op !== "publish") throw new Error(`unknown op '${request.op}'`)
    if (!owner || !can({ instance }, "write", `people/${owner}/harnesses/${id}/site`)) throw new Error("actor cannot publish")
    const path = request.path || "/brayness/site"
    await this.store.publish(id, path)
    LOG.info(`door: ${id} published ${path}`)
    return { ok: true, url: this.siteUrl.replaceAll("{id}", id) }
  }
}
