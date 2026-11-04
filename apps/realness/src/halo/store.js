import {
  appendFileSync as append_file_sync,
  existsSync as exists_sync,
  mkdirSync as mkdir_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { logger } from './log.js'

const LOG = logger('store')

export const now_iso = () =>
  new Date().toISOString().replace(/\.\d+Z$/, '+00:00')

/** What ActorStore and BoxStore share: held work and per-actor traces. */
export class Store {
  /** @type {Map<string, Set<string>>} */
  busy = new Map()
  /** @type {Set<string>} */
  turned = new Set()
  /** @type {string} */
  traces_dir

  /**
   * @abstract
   * @param {string} id
   * @returns {{ created: string }}
   */
  get(id) {
    throw new Error(`get(${id}) is not implemented`)
  }

  /**
   * @abstract
   * @param {string} id
   * @returns {Promise<unknown>}
   */
  touch(id) {
    throw new Error(`touch(${id}) is not implemented`)
  }

  /**
   * Hold an actor busy under one key, so the idle sweep and parking leave it
   * alone. The key's kind is the text before `:`; holding a key twice is one hold.
   */
  begin_work(id, key = 'work') {
    const held = this.busy.get(id) ?? new Set()
    held.add(key)
    this.busy.set(id, held)
  }

  /** Release one key; releasing a key not held does nothing. */
  end_work(id, key = 'work') {
    const held = this.busy.get(id)
    if (!held?.delete(key)) return
    if (!held.size) this.busy.delete(id)
    this.touch(id).catch(() => {})
  }

  is_busy(id) {
    return this.busy.has(id)
  }

  /** Busy actors and held work by kind: connection, turn, loop, exec, browser. */
  activity() {
    /** @type {Record<string, number>} */
    const kinds = {}
    for (const held of this.busy.values())
      for (const key of held) {
        const [kind] = key.split(':')
        kinds[kind] = (kinds[kind] ?? 0) + 1
      }
    return { actors: this.busy.size, kinds }
  }

  trace_path(id) {
    return join(this.traces_dir, `${id}.jsonl`)
  }

  /** Best effort: a trace that cannot be written must not fail what it describes. */
  trace(id, event, fields = {}) {
    const line = Object.fromEntries(
      Object.entries({ ts: now_iso(), event, ...fields }).sort(([a], [b]) =>
        a < b ? -1 : 1
      )
    )
    try {
      mkdir_sync(this.traces_dir, { recursive: true })
      append_file_sync(this.trace_path(id), `${JSON.stringify(line)}\n`)
    } catch (error) {
      LOG.warn(`could not trace ${id} ${event}: ${error.message}`)
    }
  }

  trace_of(id, limit) {
    const path = this.trace_path(id)
    if (!exists_sync(path)) return []
    const events = read_file_sync(path, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
    return limit ? events.slice(-limit) : events
  }

  /**
   * m3: time from create to the first accepted turn, the moment user code runs.
   * Recorded once; a halo restart re-reads the trace rather than trusting memory.
   */
  first_turn(id, now = Date.now()) {
    if (this.turned.has(id)) return null
    this.turned.add(id)
    if (this.trace_of(id).some(row => row.event === 'first-turn')) return null
    const created = Date.parse(this.get(id).created)
    const ms = Number.isFinite(created) ? now - created : null
    this.trace(id, 'first-turn', ms === null ? {} : { ms })
    return ms
  }
}
