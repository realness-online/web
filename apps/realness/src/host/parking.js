import { logger } from './log.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'
import {
  intent_now,
  lifecycle_html,
  lifecycle_key
} from '#root/src/sync/host-lifecycle.js'

const LOG = logger('parking')

export const PARK_AFTER_MS = 5 * MS_PER_MINUTE

/**
 * Why the host must stay up, as short phrases; empty means idle. Pure.
 * @param {{ actors: number, kinds: Record<string, number> }} activity
 * @param {{ loops_running: number, apps_running: number, held?: boolean }} counts
 */
export const park_blockers = (
  activity,
  { loops_running, apps_running, held = false }
) => [
  ...(held ? ['operator hold'] : []),
  ...Object.entries(activity.kinds).map(([kind, n]) => `${n} ${kind}`),
  ...(loops_running ? [`${loops_running} loop`] : []),
  ...(apps_running ? [`${apps_running} app`] : [])
]

/**
 * Parks the host after five idle minutes: stopping, sync and stop every actor,
 * parked, then power off. A blocked pass reopens and records running.
 */
export class Parker {
  /**
   * @param {object} options
   * @param {{ activity: () => { actors: number, kinds: Record<string, number> }, park: () => Promise<{ ok: boolean, reason?: string }>, reopen: () => void }} options.store
   * @param {{ all: () => { status: string }[] } | null} [options.loops]
   * @param {() => Promise<number>} [options.apps_running]
   * @param {() => boolean} [options.held] an operator hold, such as /run/realness-hold
   * @param {{ put: (key: string, body: string) => Promise<unknown> } | null} options.mirror
   * @param {string} options.host
   * @param {() => Promise<unknown>} options.poweroff
   * @param {() => number} [options.now]
   * @param {number} [options.after_ms]
   */
  constructor({
    store,
    loops = null,
    apps_running = () => Promise.resolve(0),
    held = () => false,
    mirror,
    host,
    poweroff,
    now = Date.now,
    after_ms = PARK_AFTER_MS
  }) {
    this.store = store
    this.loops = loops
    this.apps_running = apps_running
    this.held = held
    this.mirror = mirror
    this.host = host
    this.poweroff = poweroff
    this.now = now
    this.after_ms = after_ms
    /** @type {number | null} */
    this.idle_since = null
    this.parking = false
  }

  async blockers() {
    return park_blockers(this.store.activity(), {
      loops_running: (this.loops?.all() ?? []).filter(
        loop => loop.status === 'running'
      ).length,
      apps_running: await this.apps_running(),
      held: this.held()
    })
  }

  async #intent(intent) {
    await this.mirror?.put(
      lifecycle_key(this.host),
      lifecycle_html(intent_now(intent, { now: this.now(), by: this.host }))
    )
  }

  /** One pass. Returns what it decided, for logs and tests. */
  async check() {
    if (this.parking) return { state: 'parking' }
    const blockers = await this.blockers()
    if (blockers.length) {
      this.idle_since = null
      return { state: 'busy', blockers }
    }
    this.idle_since ??= this.now()
    if (this.now() - (this.idle_since ?? 0) < this.after_ms)
      return { state: 'idle' }

    this.parking = true
    try {
      await this.#intent('stopping')
      const parked = await this.store.park()
      const late = await this.blockers()
      if (!parked.ok || late.length) {
        const reason = parked.ok
          ? `work arrived: ${late.join(', ')}`
          : parked.reason
        this.store.reopen()
        await this.#intent('running')
        LOG.warn(`parking stopped: ${reason}`)
        return { state: 'blocked', reason }
      }
      await this.#intent('parked')
      LOG.info('parked; powering off')
      await this.poweroff()
      return { state: 'parked' }
    } catch (error) {
      this.store.reopen()
      LOG.warn(`parking failed: ${error.message}`)
      await this.#intent('running').catch(() => {})
      return { state: 'blocked', reason: error.message }
    } finally {
      this.parking = false
      this.idle_since = null
    }
  }
}
