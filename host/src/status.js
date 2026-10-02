// Host status (o1): each host writes one record through sync every 30 seconds,
// so the operator CLI and /admin see every host, even one that has stopped.
//
//   hosts/<name>/status.html   one /host item, then an /actor and /app item each
//
// The record is the last thing the host saw; `checked` says when. A stopped
// host keeps its last record, and its age tells the reader it went quiet.

import { statfsSync } from "node:fs"
import { freemem, hostname, totalmem, uptime } from "node:os"
export { read_status } from "../../sync/src/host-status.js"

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
const item = (type, values) =>
  `<article itemscope itemtype="/${type}">${Object.entries(values)
    .map(([name, value]) => `<meta itemprop="${name}" content="${esc(value)}">`)
    .join("")}</article>\n`

/** The host, its actors, and its apps as HTML Lines. */
export const status_html = ({ host, actors = [], apps = [] }) =>
  item("host", host) + actors.map((actor) => item("actor", actor)).join("") + apps.map((app) => item("app", app)).join("")

function volume_space(path) {
  try {
    const { bsize, blocks, bavail } = statfsSync(path)
    return { size: bsize * blocks, free: bsize * bavail }
  } catch {
    return { size: 0, free: 0 }
  }
}

export class HostStatus {
  constructor(store, { mirror = null, apps = null, loops = null, host = hostname(), now = () => new Date(), warn = () => {} } = {}) {
    Object.assign(this, { store, mirror, apps, loops, host, now, warn })
  }

  snapshot() {
    const actors = this.store.list()
    const count = (state) => actors.filter((actor) => actor.state === state).length
    const seed = this.store.seedStatus()
    const volume = volume_space(this.store.volume)
    const apps = this.apps?.list() ?? []
    return {
      host: {
        name: this.host,
        checked: this.now().toISOString(),
        uptime_s: Math.round(uptime()),
        seed: seed.built && seed.matches ? "ready" : seed.built ? "stale" : "missing",
        mem_total: totalmem(),
        mem_free: freemem(),
        volume_size: volume.size,
        volume_free: volume.free,
        actors_running: count("running"),
        actors_idle: count("idle"),
        actors_stopped: count("stopped"),
        loops_running: (this.loops?.all() ?? []).filter((loop) => loop.status === "running").length,
        apps: apps.length,
      },
      actors: actors.map(({ id, owner, state, created, last_activity }) => ({ id, owner, state, created, last_activity })),
      apps: apps.map(({ id, owner, public: open }) => ({ id, owner, public: Boolean(open) })),
    }
  }

  /** Write the record; a failure waits for the next pass. */
  async publish() {
    if (!this.mirror) return false
    try {
      await this.mirror.put(`hosts/${this.host}/status.html`, status_html(this.snapshot()))
      return true
    } catch (error) {
      this.warn(`host status: ${error.message}`)
      return false
    }
  }
}
