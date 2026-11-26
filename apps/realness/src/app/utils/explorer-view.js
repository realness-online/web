/* eslint-disable no-await-in-loop -- The view reconnects one connection at a time. */
import { gate_fetch } from '@/utils/gate'
import { records } from '@/utils/stream-records'

const CONFLICT = 409
const UNAUTHORIZED = 401
const RECONNECT_MS = 3000
const FOLLOW = '/v1/view?client=2'

/**
 * @typedef {{ role: string, text: string, thinking?: string }} Line
 * @typedef {{ writer: string | null, tail: number, lines: Line[] }} View
 * @typedef {{ type: 'view' } & View | { type: 'claimed', writer: string }} ViewRecord
 */

const person = token => ({ getIdToken: token })
const hidden = () => globalThis.document?.hidden === true
const IDLE_MS = 300_000
const ACTIVITY = ['pointerdown', 'keydown', 'visibilitychange']

const post = (token, path, body) =>
  gate_fetch(person(token), path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })

/**
 * Take the pen on every device.
 * @param {() => Promise<string>} token
 * @param {string} writer
 */
export const claim_view = (token, writer) =>
  post(token, '/v1/view/claim', { writer })

/**
 * Publish this writer's committed transcript; a refusal returns the view
 * that holds the pen instead.
 * @param {() => Promise<string>} token
 * @param {{ writer: string, tail: number, lines: Line[] }} view
 * @returns {Promise<{ ok: true } | { ok: false, current: View }>}
 */
export const publish_view = async (token, view) => {
  try {
    await post(token, '/v1/view', view)
    return { ok: true }
  } catch (error) {
    if (error.status !== CONFLICT) throw error
    const response = await gate_fetch(person(token), FOLLOW)
    for await (const record of records(response.body)) {
      await response.body?.cancel().catch(() => {})
      return { ok: false, current: record }
    }
    throw error
  }
}

/**
 * Follow the person's live view until the signal aborts, reconnecting after a
 * drop. A hidden or idle page holds no connection, so the gate can scale to
 * zero; the next key or tap reconnects. `on_open` hears the first record of
 * every connection, the moment a returning writer compares tails.
 * @param {() => Promise<string>} token
 * @param {{ on_open: (view: ViewRecord) => void | Promise<void>, on_record: (record: ViewRecord) => void | Promise<void>, signal: AbortSignal, idle_ms?: number }} handlers
 */
export const watch_view = async (
  token,
  { on_open, on_record, signal, idle_ms = IDLE_MS }
) => {
  let asleep = false
  let idle_timer
  let wake = () => {}
  let sleep = () => {}
  const doze = () => {
    asleep = true
    sleep()
  }
  const active = () => {
    clearTimeout(idle_timer)
    if (hidden()) return doze()
    asleep = false
    idle_timer = setTimeout(doze, idle_ms)
    wake()
  }
  for (const type of ACTIVITY)
    globalThis.document?.addEventListener(type, active)
  active()
  try {
    while (!signal.aborted) {
      if (asleep) {
        await new Promise(done => {
          wake = () => done(undefined)
          signal.addEventListener('abort', done, { once: true })
        })
        wake = () => {}
        continue
      }
      const connection = new AbortController()
      const close = () => connection.abort()
      sleep = close
      signal.addEventListener('abort', close)
      try {
        const response = await gate_fetch(person(token), FOLLOW, {
          signal: connection.signal
        })
        let first = true
        for await (const record of records(response.body)) {
          if (first) await on_open(record)
          else await on_record(record)
          first = false
        }
      } catch (error) {
        if (signal.aborted) return
        if (error.status === UNAUTHORIZED) return
      } finally {
        sleep = () => {}
        signal.removeEventListener('abort', close)
      }
      if (connection.signal.aborted) continue
      await new Promise(done => {
        const timer = setTimeout(done, RECONNECT_MS)
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          done(undefined)
        })
      })
    }
  } finally {
    clearTimeout(idle_timer)
    for (const type of ACTIVITY)
      globalThis.document?.removeEventListener(type, active)
  }
}

/**
 * What a returning writer does with the view it finds.
 * A fresh tab that has seen no writer takes the pen; equal tails continue; another writer's longer tail with no local commits
 * hands over the pen; both moving makes this log a branch.
 * @param {{ writer: string, seen: { writer: string | null, tail: number }, local_moved: boolean }} self
 * @param {View} found
 * @returns {'continue' | 'yield' | 'branch'}
 */
export const compare_tails = ({ writer, seen, local_moved }, found) => {
  if (!found.writer || found.writer === writer) return 'continue'
  if (!seen.writer) return 'continue'
  const moved = found.writer !== seen.writer || found.tail !== seen.tail
  if (!moved) return 'continue'
  return local_moved ? 'branch' : 'yield'
}

/**
 * Another device's lines, as one context note.
 * @param {Line[]} lines
 */
export const upstream_note = lines =>
  [
    'From the conversation on another device:',
    ...lines.map(line => `${line.role}: ${line.text}`)
  ].join('\n')
