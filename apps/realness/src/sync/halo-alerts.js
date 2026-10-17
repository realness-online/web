import { quiet_halos } from './halo-watch.js'
import { CAUSE_TEXT } from './halo-power.js'
import { MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND } from '#root/lib/units.js'

const ALERT_TIMEOUT_MS = 10_000

export const FIRST_REPEAT_MS = 5 * MS_PER_MINUTE
export const REPEAT_MS = MS_PER_HOUR
const STATE_KEY = 'alerts/halo-watch.json'

const span = ms =>
  ms < MS_PER_MINUTE
    ? `${Math.round(ms / MS_PER_SECOND)}s`
    : `${Math.round(ms / MS_PER_MINUTE)}m`

const cause = host => (host.cause ? `: ${CAUSE_TEXT[host.cause]}` : '')

/**
 * What to send now, and the state to keep once each send succeeds. Pure:
 * `state` is `{ [halo]: { since, sent, repeats } }`. `next: null` means the
 * halo recovered; its state is dropped.
 */
export const halo_alerts = (state, quiet, now) => {
  const actions = []
  const reporting = new Set(quiet.map(host => host.name))
  for (const host of quiet) {
    const prev = state[host.name]
    if (!prev)
      actions.push({
        kind: 'down',
        name: host.name,
        text: `realness halo ${host.name} stopped reporting${cause(host)}`,
        next: { since: now, sent: now, repeats: 0 }
      })
    else if (
      now - prev.sent >=
      (prev.repeats === 0 ? FIRST_REPEAT_MS : REPEAT_MS)
    )
      actions.push({
        kind: 'repeat',
        name: host.name,
        text: `realness halo ${host.name} is still quiet (${span(now - prev.since)})${cause(host)}`,
        next: { ...prev, sent: now, repeats: prev.repeats + 1 }
      })
  }
  for (const name of Object.keys(state))
    if (!reporting.has(name))
      actions.push({
        kind: 'up',
        name,
        text: `realness halo ${name} is reporting again`,
        next: null
      })

  return actions
}

/** Slack reads `text`, Discord reads `content`; each ignores the other key. */
export const webhook_body = (url, text) =>
  String(url).includes('discord') ? { content: text } : { text }

const deliver = async (webhook, text, fetcher = fetch) => {
  if (!webhook) throw new Error('no HALO_ALERT_WEBHOOK is set')
  const response = await fetcher(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(webhook_body(webhook, text)),
    signal: AbortSignal.timeout(ALERT_TIMEOUT_MS)
  })
  if (!response.ok) throw new Error(`webhook answered ${response.status}`)
}

/** One pass. Returns what was sent. A read failure skips the pass, never recovers. */
/**
 * Send the alerts that are due, then save the state that says so.
 * @param {object} options
 * @param {{ get: (key: string) => Promise<{ body: Buffer } | null>, put: (key: string, body: string) => Promise<unknown> }} options.storage
 * @param {string | null} options.webhook
 * @param {(() => Promise<Map<string, string>>) | null} [options.statuses]
 * @param {() => number} [options.now]
 * @param {(message: string) => void} [options.warn]
 * @param {typeof fetch} [options.fetcher]
 */
export const run_halo_alerts = async ({
  storage,
  webhook,
  statuses = null,
  now = Date.now,
  warn = () => {},
  fetcher = fetch
}) => {
  let state, quiet
  try {
    const file = await storage.get(STATE_KEY)
    state = file ? JSON.parse(file.body.toString('utf8')) : {}
    quiet = await quiet_halos(storage, { now: now(), statuses })
  } catch (error) {
    warn(`halo alerts skipped: ${error.message}`)
    return []
  }
  const sent = []
  for (const action of halo_alerts(state, quiet, now()))
    try {
      await deliver(webhook, action.text, fetcher)
      if (action.next) state[action.name] = action.next
      else delete state[action.name]
      sent.push({ kind: action.kind, name: action.name })
    } catch (error) {
      warn(`halo alert ${action.kind} ${action.name}: ${error.message}`)
    }

  if (sent.length)
    try {
      await storage.put(STATE_KEY, `${JSON.stringify(state, null, 2)}\n`)
    } catch (error) {
      warn(`halo alert state not saved: ${error.message}`)
    }

  return sent
}
