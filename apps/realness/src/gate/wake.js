import { connect } from 'node:net'
import { HTTP } from '#root/lib/http.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
import { WAKE_DEADLINE_MS, intent_now } from '#root/src/sync/halo-lifecycle.js'

const POLL_MS = 2 * MS_PER_SECOND
/**
 * A start sent while the halo is still stopping is dropped by Compute Engine,
 * so the starter repeats it. A start on a running halo does nothing.
 */
const RESTART_SECONDS = 15
const RESTART_MS = RESTART_SECONDS * MS_PER_SECOND
const PROBE_TIMEOUT_MS = 2 * MS_PER_SECOND

/** The halo missed the wake deadline; the caller shows a failure with retry. */
export class WakeTimeout extends Error {
  status = HTTP.UNAVAILABLE
}

/** Whether the halo API accepts a connection. Never throws. */
export const tcp_probe = ({ host, api_port }, timeout_ms = PROBE_TIMEOUT_MS) =>
  /** @type {Promise<boolean>} */
  (
    new Promise(done => {
      const socket = connect({ host, port: api_port })
      const finish = up => {
        socket.destroy()
        done(up)
      }
      socket.setTimeout(timeout_ms, () => finish(false))
      socket.once('connect', () => finish(true))
      socket.once('error', () => finish(false))
    })
  )

/**
 * Start one Compute Engine instance, and nothing else. The token's account
 * should hold only `compute.instances.start` on this instance.
 * @param {{ project: string, zone: string, name: string, token: () => Promise<string>, fetcher?: typeof fetch }} options
 */
export const gce_start =
  ({ project, zone, name, token, fetcher = fetch }) =>
  async () => {
    const url = `https://compute.googleapis.com/compute/v1/projects/${project}/zones/${zone}/instances/${name}/start`
    const reply = await fetcher(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${await token()}` }
    })
    if (!reply.ok) throw new Error(`halo start refused: ${reply.status}`)
  }

/**
 * Wake one halo on demand. Concurrent callers in this instance share one
 * wake; other instances see the `starting` intent and wait instead of
 * starting again. Every wait ends by the deadline.
 * @param {object} options
 * @param {() => Promise<boolean>} options.probe
 * @param {() => Promise<void>} options.start
 * @param {() => Promise<{ intent: string, until: string } | null>} options.read_intent
 * @param {(record: ReturnType<typeof intent_now>) => Promise<unknown>} options.write_intent
 * @param {() => number} [options.now]
 * @param {(ms: number) => Promise<void>} [options.pause]
 * @param {number} [options.deadline_ms]
 * @param {number} [options.poll_ms]
 * @param {number} [options.restart_ms] how often the starter repeats its start while waiting
 * @param {(stage: string) => void} [options.stage]
 */
export const make_waker = ({
  probe,
  start,
  read_intent,
  write_intent,
  now = Date.now,
  pause = ms =>
    new Promise(done => {
      setTimeout(done, ms)
    }),
  deadline_ms = WAKE_DEADLINE_MS,
  poll_ms = POLL_MS,
  restart_ms = RESTART_MS,
  stage = () => {}
}) => {
  /** @type {Promise<void> | null} */
  let waking = null
  /** @type {Set<(event: WakeEvent) => void>} */
  const watchers = new Set()
  /** @type {WakeEvent | null} */
  let last = null
  let began = 0

  /** @param {'starting' | 'complete' | 'failed'} state */
  const emit = (state, note) => {
    last = { stage: 'starting_halo', state, elapsed_ms: now() - began, note }
    stage(note)
    for (const watch of watchers) watch(last)
  }

  const wake = async () => {
    began = now()
    const intent = await read_intent()
    const shared_until =
      intent?.intent === 'starting' ? Date.parse(intent.until) : NaN
    let until
    /** When this instance last asked for a start; null when another instance is starting. */
    /** @type {number | null} */
    let started_at = null
    if (Number.isFinite(shared_until) && now() < shared_until) {
      until = shared_until
      emit('starting', 'waiting for another wake')
    } else {
      const record = intent_now('starting', {
        now: now(),
        by: 'gate',
        deadline_ms
      })
      await write_intent(record)
      until = Date.parse(record.until)
      emit('starting', 'starting halo')
      await start()
      started_at = now()
    }
    while (now() < until) {
      // eslint-disable-next-line no-await-in-loop -- polling waits between tries
      await pause(poll_ms)
      if (started_at !== null && now() - started_at >= restart_ms) {
        started_at = now()
        // eslint-disable-next-line no-await-in-loop -- a repeat start waits like the first
        await start().catch(error => stage(`start repeated: ${error.message}`))
      }
      // eslint-disable-next-line no-await-in-loop -- one probe per pause
      if (await probe()) {
        // eslint-disable-next-line no-await-in-loop -- terminal write runs once after readiness
        await write_intent(intent_now('running', { now: now(), by: 'gate' }))
        emit('complete', 'halo ready')
        return
      }
    }
    emit('failed', 'halo did not wake')
    throw new WakeTimeout('the halo did not wake in time; try again')
  }

  /**
   * Resolves once the halo answers; the cheap path is one probe. A watcher
   * sees the shared wake's stages, starting with the latest one.
   * @param {{ watch?: (event: WakeEvent) => void }} [options]
   */
  return async ({ watch } = {}) => {
    if (await probe()) return
    if (watch) watchers.add(watch)
    try {
      if (!waking) {
        last = null
        waking = wake().finally(() => {
          waking = null
        })
      } else if (last && watch) watch(last)
      await waking
    } finally {
      if (watch) watchers.delete(watch)
    }
  }
}

/**
 * @typedef {{ stage: 'starting_halo', state: 'starting' | 'complete' | 'failed', elapsed_ms: number, note: string }} WakeEvent
 */
