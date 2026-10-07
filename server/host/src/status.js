// Host status (o1): each host writes one record through sync every 30 seconds,
// so the operator CLI and /admin see every host, even one that has stopped.
//
//   hosts/<name>/status.html   one /host item, then an /actor and /app item each
//
// The record is the last thing the host saw; `checked` says when. A stopped
// host keeps its last record, and its age tells the reader it went quiet.

import { readdirSync as readdir_sync, readFileSync as read_file_sync, statfsSync as statfs_sync } from "node:fs"
import { freemem, hostname, totalmem, uptime } from "node:os"
import { metrics_from, metric_fields } from "./metrics.js"
import { connect } from "./vsock.js"
export { read_status } from "#root/server/sync/src/host-status.js"

// Each report probes a few running actors, so the round is bounded and cheap.
const PROBE_LIMIT = 4
const PROBE_TIMEOUT_MS = 2000
const TAP_LIMIT = 63
// Traces are per actor and grow without bound; a summary reads only the tail.
const TRACE_WINDOW = 200

const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
const item = (type, values) =>
  `<article itemscope itemtype="/${type}">${Object.entries(values)
    .map(([name, value]) => `<meta itemprop="${name}" content="${esc(value)}">`)
    .join("")}</article>\n`

/** The host, its actors, and its apps as HTML Lines. */
export const status_html = ({ host, actors = [], apps = [] }) =>
  item("host", host) + actors.map((actor) => item("actor", actor)).join("") + apps.map((app) => item("app", app)).join("")

/** Available memory and actor TAP use, as the host sees them. */
export const host_resources = (tap_prefix = "fc-tap", { read_file = (path) => read_file_sync(path, "utf8"), list_network = () => readdir_sync("/sys/class/net") } = {}) => {
  const errors = []
  let mem_available = null
  try {
    const match = /^MemAvailable:\s+(\d+) kB$/m.exec(read_file("/proc/meminfo"))
    mem_available = match ? Number(match[1]) * 1024 : null
  } catch (error) {
    errors.push(error.message)
  }
  let actor_taps_used = null
  try {
    actor_taps_used = list_network().filter((name) => name.startsWith(tap_prefix) && Number(name.slice(tap_prefix.length)) >= 1 && Number(name.slice(tap_prefix.length)) <= TAP_LIMIT).length
  } catch (error) {
    errors.push(error.message)
  }
  return { mem_available, actor_taps_used, actor_taps_limit: TAP_LIMIT, resource_error: errors.join("; ") || null }
}

const volume_space = (path) => {
  try {
    const { bsize, blocks, bavail } = statfs_sync(path)
    return { size: bsize * blocks, free: bsize * bavail }
  } catch {
    return { size: 0, free: 0 }
  }
}

export class HostStatus {
  constructor(store, { mirror = null, apps = null, loops = null, host = hostname(), now = () => new Date(), warn = () => {}, resources = () => host_resources(store.tapPrefix), probe = null, clock = () => Date.now(), traces = null } = {}) {
    Object.assign(this, { store, mirror, apps, loops, host, now, warn, resources, probe, clock })
    this.traces = traces ?? (() => (typeof store.traceOf === "function" ? store.list().map((actor) => store.traceOf(actor.id, TRACE_WINDOW)) : []))
    this.#next_probe = 0
  }

  #next_probe

  /** Running actors answer a cheap command; the rest are marked skipped. */
  async #probe_actors(actors, checked) {
    const running = actors.filter((actor) => actor.state === "running")
    const start = running.length ? this.#next_probe % running.length : 0
    const chosen = Array.from({ length: Math.min(PROBE_LIMIT, running.length) }, (_, index) => running[(start + index) % running.length])
    this.#next_probe = running.length ? (start + chosen.length) % running.length : 0
    const probe = this.probe ?? (async (record) => {
      const { socket } = await connect(record.vsockPath, this.store.vsockPort ?? 52)
      socket.destroy()
    })
    const results = new Map()
    for (const record of chosen) {
      const started = this.clock()
      try {
        await Promise.race([
          probe(record, this.store.vsockPort ?? 52),
          new Promise((_, fail) => setTimeout(() => fail(new Error(`no guest response in ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS).unref?.()),
        ])
        results.set(record.id, { probe_status: "ok", probe_ms: Math.round(this.clock() - started), probe_checked: checked })
      } catch (error) {
        results.set(record.id, { probe_status: "failed", probe_ms: Math.round(this.clock() - started), probe_checked: checked, probe_error: error.message })
      }
    }
    return results
  }

  /** p50 and p99 for create, reload, and probe, from each actor's trace tail. */
  #metrics() {
    try {
      const windows = this.traces()
      return metrics_from(windows.map((_, index) => index), (index) => windows[index])
    } catch (error) {
      this.warn(`host metrics: ${error.message}`)
      return {}
    }
  }

  async snapshot() {
    const actors = this.store.list()
    const count = (state) => actors.filter((actor) => actor.state === state).length
    const seed = this.store.seedStatus()
    const volume = volume_space(this.store.volume)
    const resources = this.resources()
    const checked = this.now().toISOString()
    const probes = await this.#probe_actors(actors, checked)
    const apps = this.apps?.list() ?? []
    const metrics = metric_fields(this.#metrics())
    return {
      host: {
        name: this.host,
        checked,
        uptime_s: Math.round(uptime()),
        seed: seed.built && seed.matches ? "ready" : seed.built ? "stale" : "missing",
        mem_total: totalmem(),
        mem_free: freemem(),
        mem_available: resources.mem_available,
        actor_taps_used: resources.actor_taps_used,
        actor_taps_limit: resources.actor_taps_limit,
        resource_error: resources.resource_error,
        volume_size: volume.size,
        volume_free: volume.free,
        actors_running: count("running"),
        actors_idle: count("idle"),
        actors_stopped: count("stopped"),
        loops_running: (this.loops?.all() ?? []).filter((loop) => loop.status === "running").length,
        apps: apps.length,
        ...metrics,
      },
      actors: actors.map(({ id, owner, state, created, last_activity }) => ({
        id,
        owner,
        state,
        created,
        last_activity,
        probe_status: state === "running" ? probes.get(id)?.probe_status ?? "pending" : "skipped",
        ...(probes.get(id) ?? {}),
      })),
      apps: apps.map(({ id, owner, public: open }) => ({ id, owner, public: Boolean(open) })),
    }
  }

  /** Write the record; a failure waits for the next pass. */
  async publish() {
    if (!this.mirror) return false
    try {
      await this.mirror.put(`hosts/${this.host}/status.html`, status_html(await this.snapshot()))
      return true
    } catch (error) {
      this.warn(`host status: ${error.message}`)
      return false
    }
  }
}
