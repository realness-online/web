// m8: an alert when a host goes quiet, a recovery note when it returns.
// Sync scales to zero, so there is no timer here: Cloud Scheduler wakes
// `POST /v1/host-watch/run`, and each run decides what is due from stored
// state. State is kept only after a message is delivered, so a failed send
// is retried on the next run rather than lost.
import { quiet_hosts } from "./host-watch.js"

// The first repeat comes quickly, so a short outage is not lost in noise;
// after that the same outage repeats hourly.
export const FIRST_REPEAT_MS = 5 * 60_000
export const REPEAT_MS = 60 * 60_000
const STATE_KEY = "alerts/host-watch.json"

const span = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60_000)}m`)

/**
 * What to send now, and the state to keep once each send succeeds. Pure:
 * `state` is `{ [host]: { since, sent, repeats } }`. `next: null` means the
 * host recovered; its state is dropped.
 */
export const host_alerts = (state, quiet, now) => {
  const actions = []
  const reporting = new Set(quiet.map((host) => host.name))
  for (const host of quiet) {
    const prev = state[host.name]
    if (!prev) {
      actions.push({ kind: "down", name: host.name, text: `brayness host ${host.name} stopped reporting`, next: { since: now, sent: now, repeats: 0 } })
    } else if (now - prev.sent >= (prev.repeats === 0 ? FIRST_REPEAT_MS : REPEAT_MS)) {
      actions.push({ kind: "repeat", name: host.name, text: `brayness host ${host.name} is still quiet (${span(now - prev.since)})`, next: { ...prev, sent: now, repeats: prev.repeats + 1 } })
    }
  }
  for (const name of Object.keys(state)) {
    if (!reporting.has(name)) actions.push({ kind: "up", name, text: `brayness host ${name} is reporting again`, next: null })
  }
  return actions
}

/** Slack reads `text`, Discord reads `content`; each ignores the other key. */
export const webhook_body = (url, text) => (String(url).includes("discord") ? { content: text } : { text })

const deliver = async (webhook, text, fetcher = fetch) => {
  if (!webhook) throw new Error("no HOST_ALERT_WEBHOOK is set")
  const response = await fetcher(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(webhook_body(webhook, text)),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`webhook answered ${response.status}`)
}

/** One pass. Returns what was sent. A read failure skips the pass, never recovers. */
export const run_host_alerts = async ({ storage, webhook, now = Date.now, warn = () => {}, fetcher = fetch }) => {
  let state, quiet
  try {
    const file = await storage.get(STATE_KEY)
    state = file ? JSON.parse(file.body.toString("utf8")) : {}
    quiet = await quiet_hosts(storage, { now: now() })
  } catch (error) {
    warn(`host alerts skipped: ${error.message}`)
    return []
  }
  const sent = []
  for (const action of host_alerts(state, quiet, now())) {
    try {
      await deliver(webhook, action.text, fetcher)
      if (action.next) state[action.name] = action.next
      else delete state[action.name]
      sent.push({ kind: action.kind, name: action.name })
    } catch (error) {
      warn(`host alert ${action.kind} ${action.name}: ${error.message}`)
    }
  }
  if (sent.length) {
    // A dropped state write repeats the message next run; a lost one never does.
    try {
      await storage.put(STATE_KEY, `${JSON.stringify(state, null, 2)}\n`)
    } catch (error) {
      warn(`host alert state not saved: ${error.message}`)
    }
  }
  return sent
}