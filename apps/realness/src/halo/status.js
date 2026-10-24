import {
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  statfsSync as statfs_sync
} from 'node:fs'
import { freemem, hostname, totalmem, uptime } from 'node:os'
import { metrics_from, metric_fields } from './metrics.js'
import { connect } from './vsock.js'
import { LAST_TAP as TAP_LIMIT } from './syscalls.js'
import { KIB } from '#root/lib/units.js'
import { item_html } from '#root/lib/items.js'
/* eslint-disable no-await-in-loop -- guests are probed one at a time to bound halo load */

const GUEST_PORT = 52
export { read_status } from '#root/src/sync/halo-status.js'

const PROBE_LIMIT = 4
const PROBE_TIMEOUT_MS = 2000
const TRACE_WINDOW = 200

const seed_state = seed => {
  if (!seed.built) return 'missing'
  return seed.matches ? 'ready' : 'stale'
}

const item = (type, values) => item_html(type, values)

const HELD_KINDS = ['connection', 'turn', 'loop', 'exec', 'browser']

/** Busy actors and held work by kind as flat record fields; absent when unknown. */
export const activity_fields = activity =>
  activity
    ? {
        actors_busy: activity.actors,
        ...Object.fromEntries(
          HELD_KINDS.map(kind => [`held_${kind}`, activity.kinds[kind] ?? 0])
        )
      }
    : {}

/**
 * The halo, its actors, and its apps as HTML Lines.
 * @param {{ halo: object, actors?: object[], apps?: object[] }} status
 */
export const status_html = ({ halo, actors = [], apps = [] }) =>
  item('halo', halo) +
  actors.map(actor => item('actor', actor)).join('') +
  apps.map(app => item('app', app)).join('')

/** Available memory and actor TAP use, as the halo sees them. */
export const halo_resources = (
  tap_prefix = 'fc-tap',
  {
    read_file = path => read_file_sync(path, 'utf8'),
    list_network = () => readdir_sync('/sys/class/net')
  } = {}
) => {
  const errors = []
  /** @type {number | null} */
  let mem_available = null
  try {
    const match = /^MemAvailable:\s+(\d+) kB$/m.exec(read_file('/proc/meminfo'))
    mem_available = match ? Number(match[1]) * KIB : null
  } catch (error) {
    errors.push(error.message)
  }
  /** @type {number | null} */
  let actor_taps_used = null
  try {
    actor_taps_used = list_network().filter(
      name =>
        name.startsWith(tap_prefix) &&
        Number(name.slice(tap_prefix.length)) >= 1 &&
        Number(name.slice(tap_prefix.length)) <= TAP_LIMIT
    ).length
  } catch (error) {
    errors.push(error.message)
  }
  return {
    mem_available,
    actor_taps_used,
    actor_taps_limit: TAP_LIMIT,
    resource_error: errors.join('; ') || null
  }
}

const volume_space = path => {
  try {
    const { bsize, blocks, bavail } = statfs_sync(path)
    return { size: bsize * blocks, free: bsize * bavail }
  } catch {
    return { size: 0, free: 0 }
  }
}

export class HaloStatus {
  /** @type {import('./actors.js').ActorStore} */
  store
  /** @type {{ get: (path: string) => Promise<unknown>, put: (path: string, body: string) => Promise<unknown> } | null} */
  mirror
  /** @type {import('./apps.js').AppStore | null} */
  apps
  /** @type {import('./loops.js').Loops | null} */
  loops
  /** @type {string} */
  halo
  /** @type {() => Date} */
  now
  /** @type {(message: string) => void} */
  warn
  /** @type {() => { mem_available: number | null, actor_taps_used: number | null, actor_taps_limit: number, resource_error: string | null }} */
  resources
  /** @type {((record: import('./actors.js').Actor, port: number) => Promise<void>) | null} */
  probe
  /** @type {() => number} */
  clock
  /** @type {() => object[]} */
  traces

  /**
   * @param {import('./actors.js').ActorStore} store
   * @param {object} [options]
   * @param {{ get: (path: string) => Promise<unknown>, put: (path: string, body: string) => Promise<unknown> } | null} [options.mirror]
   * @param {import('./apps.js').AppStore | null} [options.apps]
   * @param {import('./loops.js').Loops | null} [options.loops]
   * @param {string} [options.halo]
   * @param {() => Date} [options.now]
   * @param {(message: string) => void} [options.warn]
   * @param {() => { mem_available: number | null, actor_taps_used: number | null, actor_taps_limit: number, resource_error: string | null }} [options.resources]
   * @param {((record: import('./actors.js').Actor, port: number) => Promise<void>) | null} [options.probe]
   * @param {() => number} [options.clock]
   * @param {(() => object[]) | null} [options.traces]
   */
  constructor(
    store,
    {
      mirror = null,
      apps = null,
      loops = null,
      halo = hostname(),
      now = () => new Date(),
      warn = () => {},
      resources = () => halo_resources(store.tap_prefix),
      probe = null,
      clock = () => Date.now(),
      traces = null
    } = {}
  ) {
    Object.assign(this, {
      store,
      mirror,
      apps,
      loops,
      halo,
      now,
      warn,
      resources,
      probe,
      clock
    })
    this.traces =
      traces ??
      (() =>
        typeof store.traceOf === 'function'
          ? store.list().map(actor => store.traceOf(actor.id, TRACE_WINDOW))
          : [])
    this.#next_probe = 0
  }

  #next_probe

  /** Running actors answer a cheap command; the rest are marked skipped. */
  async #probe_actors(actors, checked) {
    const running = actors.filter(actor => actor.state === 'running')
    const start = running.length ? this.#next_probe % running.length : 0
    const chosen = Array.from(
      { length: Math.min(PROBE_LIMIT, running.length) },
      (_, index) => running[(start + index) % running.length]
    )
    this.#next_probe = running.length
      ? (start + chosen.length) % running.length
      : 0
    const probe =
      this.probe ??
      (async record => {
        const { socket } = await connect(
          record.vsock_path,
          this.store.vsock_port ?? GUEST_PORT
        )
        socket.destroy()
      })
    const results = new Map()
    for (const record of chosen) {
      const started = this.clock()
      try {
        await Promise.race([
          probe(record, this.store.vsock_port ?? GUEST_PORT),
          new Promise((_, fail) => {
            setTimeout(
              () =>
                fail(new Error(`no guest response in ${PROBE_TIMEOUT_MS}ms`)),
              PROBE_TIMEOUT_MS
            ).unref?.()
          })
        ])
        results.set(record.id, {
          probe_status: 'ok',
          probe_ms: Math.round(this.clock() - started),
          probe_checked: checked
        })
      } catch (error) {
        results.set(record.id, {
          probe_status: 'failed',
          probe_ms: Math.round(this.clock() - started),
          probe_checked: checked,
          probe_error: error.message
        })
      }
    }
    return results
  }

  /** p50 and p99 for create, reload, and probe, from each actor's trace tail. */
  #metrics() {
    try {
      const windows = this.traces()
      return metrics_from(
        windows.map((_, index) => index),
        index => windows[index]
      )
    } catch (error) {
      this.warn(`halo metrics: ${error.message}`)
      return {}
    }
  }

  async snapshot() {
    const actors = this.store.list()
    const count = state => actors.filter(actor => actor.state === state).length
    const seed = this.store.seedStatus()
    const volume = volume_space(this.store.volume)
    const resources = this.resources()
    const checked = this.now().toISOString()
    const probes = await this.#probe_actors(actors, checked)
    const apps = this.apps?.list() ?? []
    const metrics = metric_fields(this.#metrics())
    return {
      halo: {
        name: this.halo,
        checked,
        uptime_s: Math.round(uptime()),
        seed: seed_state(seed),
        mem_total: totalmem(),
        mem_free: freemem(),
        mem_available: resources.mem_available,
        actor_taps_used: resources.actor_taps_used,
        actor_taps_limit: resources.actor_taps_limit,
        resource_error: resources.resource_error,
        volume_size: volume.size,
        volume_free: volume.free,
        actors_running: count('running'),
        actors_idle: count('idle'),
        actors_stopped: count('stopped'),
        loops_running: (this.loops?.all() ?? []).filter(
          loop => loop.status === 'running'
        ).length,
        apps: apps.length,
        ...activity_fields(this.store.activity?.()),
        ...metrics
      },
      actors: actors.map(({ id, owner, state, created, last_activity }) => ({
        id,
        owner,
        state,
        created,
        last_activity,
        probe_status:
          state === 'running'
            ? (probes.get(id)?.probe_status ?? 'pending')
            : 'skipped',
        ...probes.get(id)
      })),
      apps: apps.map(({ id, owner, public: open }) => ({
        id,
        owner,
        public: Boolean(open)
      }))
    }
  }

  /** Write the record; a failure waits for the next pass. */
  async publish() {
    if (!this.mirror) return false
    try {
      await this.mirror.put(
        `halos/${this.halo}/status.html`,
        status_html(await this.snapshot())
      )
      return true
    } catch (error) {
      this.warn(`halo status: ${error.message}`)
      return false
    }
  }
}
