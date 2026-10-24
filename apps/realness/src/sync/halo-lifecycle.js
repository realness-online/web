import { read_status } from './halo-status.js'
import { MS_PER_MINUTE, MS_PER_SECOND } from '#root/lib/units.js'
import { item_html, read_item } from '#root/lib/items.js'

/** What an operator or halo intends; reports decide whether it happened. */
const INTENTS = new Set(['starting', 'running', 'stopping', 'parked'])

const OPERATOR_START_MINUTES = 15

export const WAKE_DEADLINE_MS = 90 * MS_PER_SECOND
export const STOP_DEADLINE_MS = 5 * MS_PER_MINUTE
export const OPERATOR_START_MS = OPERATOR_START_MINUTES * MS_PER_MINUTE

const DEADLINES = { starting: WAKE_DEADLINE_MS, stopping: STOP_DEADLINE_MS }

export const lifecycle_key = name => `halos/${name}/lifecycle.html`

/**
 * One intent as microdata. `until` bounds starting and stopping; past it the
 * halo is failed unless a report says otherwise.
 * @param {{ intent: string, at: string, until?: string, by?: string }} record
 */
export const lifecycle_html = ({ intent, at, until = '', by = '' }) => {
  if (!INTENTS.has(intent)) throw new Error(`unknown halo intent ${intent}`)
  return item_html('halo-lifecycle', { intent, at, until, by })
}

/** @returns {{ intent: string, at: string, until: string, by: string } | null} */
export const read_lifecycle = html => {
  const read = read_item(html ?? '', 'halo-lifecycle')
  if (!read) return null
  const values = {
    intent: read.intent ?? '',
    at: read.at ?? '',
    until: read.until ?? '',
    by: read.by ?? ''
  }
  return INTENTS.has(values.intent) && Number.isFinite(Date.parse(values.at))
    ? values
    : null
}

/**
 * An intent record that starts now, with its deadline when it has one.
 * @param {string} intent
 * @param {{ now?: number, by?: string, deadline_ms?: number }} [options]
 */
export const intent_now = (
  intent,
  { now = Date.now(), by = '', deadline_ms } = {}
) => {
  const limit = deadline_ms ?? DEADLINES[intent] ?? 0
  return {
    intent,
    at: new Date(now).toISOString(),
    until: limit ? new Date(now + limit).toISOString() : '',
    by
  }
}

/**
 * parked, starting, running, stopping, or failed. Pure. `checked` is the
 * halo's last report time; a report newer than the intent overrides
 * parked and starting, since the halo is plainly up.
 * @param {{ lifecycle: ReturnType<typeof read_lifecycle>, checked: string, now: number, quiet_ms: number }} input
 */
export const halo_state = ({ lifecycle, checked, now, quiet_ms }) => {
  const reported = Date.parse(checked)
  const fresh = Number.isFinite(reported) && now - reported <= quiet_ms
  const since = lifecycle ? Date.parse(lifecycle.at) : -Infinity
  const after_intent = fresh && reported >= since
  const before = lifecycle?.until ? now <= Date.parse(lifecycle.until) : false

  switch (lifecycle?.intent) {
    case 'parked':
      return after_intent ? 'running' : 'parked'
    case 'stopping':
      return before ? 'stopping' : 'failed'
    case 'starting':
      if (after_intent) return 'running'
      return before ? 'starting' : 'failed'
    default:
      return fresh ? 'running' : 'failed'
  }
}

/** Read both records for one halo and classify it. */
export const read_halo_state = async (storage, name, { now, quiet_ms }) => {
  const [status, life] = await Promise.all([
    storage.get(`halos/${name}/status.html`),
    storage.get(lifecycle_key(name))
  ])
  const checked = status
    ? (read_status(status.body.toString('utf8')).halo?.checked ?? '')
    : ''
  const lifecycle = life ? read_lifecycle(life.body.toString('utf8')) : null
  return {
    checked,
    lifecycle,
    state: halo_state({ lifecycle, checked, now, quiet_ms })
  }
}
