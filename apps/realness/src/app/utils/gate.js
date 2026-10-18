import { records } from '@/utils/stream-records'
import { browser_settings } from '../../settings/environments.js'

/** The gate's base URL for this build's environment. */
export const gate_url = () =>
  new URL(
    browser_settings(import.meta.env.MODE).gate_url,
    window.location.origin
  ).href.replace(/\/$/, '')

/** A refusal the caller can tell apart from a dropped network. */
const UNAUTHORIZED = 401
const UNAVAILABLE = 503
const refused = (status, message) =>
  Object.assign(new Error(message), { status })

/** One halo API call through the gate; resolves to the response, or throws. */
export const gate_fetch = async (user, path, init = {}) => {
  const response = await fetch(`${gate_url()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${await user.getIdToken()}`
    }
  })
  if (response.status === UNAVAILABLE)
    throw refused(
      UNAVAILABLE,
      (await response.text()).trim() || 'Realness is starting; try again'
    )
  if (!response.ok)
    throw refused(response.status, `Realness answered ${response.status}`)
  return response
}

/** One halo API call through the gate; resolves to its JSON. */
export const gate_api = async (user, path, init = {}) =>
  (await gate_fetch(user, path, init)).json()

/** The person's most recently used actor, or a new one. */
export const choose_actor = async user => {
  const { actors } = await gate_api(user, '/v1/actors')
  const when = actor => String(actor.last_activity || actor.created || '')
  const [newest] = actors.sort((a, b) => when(b).localeCompare(when(a)))
  if (newest) return { id: newest.id, created: false }
  const made = await gate_api(user, '/v1/actors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })
  return { id: made.id, created: true }
}

/**
 * Start or rejoin an actor startup; stage events retain their server correlation ID.
 * @param {any} user
 * @param {{actor?: string, startup_id?: string, on_progress?: (event: any) => void, signal?: AbortSignal}} [options]
 */
export const start_actor = async (
  user,
  { actor, startup_id, on_progress = () => {}, signal } = {}
) => {
  const response = await gate_fetch(user, '/v1/startup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor, startup_id }),
    signal
  })
  let correlated = startup_id
  try {
    for await (const event of records(response.body)) {
      if (event.source === 'gate') {
        on_progress(event)
        continue
      }
      if (event.type === 'error' && !event.startup_id)
        throw refused(UNAVAILABLE, event.text)
      if (correlated && correlated !== event.startup_id)
        throw new Error('Startup progress changed identity')
      correlated = event.startup_id
      on_progress(event)
      if (event.type === 'error') throw new Error(event.text)
      if (event.type === 'actor-ready')
        return {
          id: event.actor_id,
          created: event.created,
          startup_id: correlated
        }
    }
    throw new Error('Startup progress ended before the actor was ready')
  } catch (error) {
    throw Object.assign(error, { startup_id: correlated })
  }
}

/** A terminal socket to `actor`; the token rides as the second subprotocol. */
export const open_terminal = async (user, actor, { cols, rows }) => {
  const token = await user.getIdToken()
  if (!token) throw refused(UNAUTHORIZED, 'sign in first')
  const url = new URL(`${gate_url()}/pty`)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  url.search = new URLSearchParams({ actor, cols, rows }).toString()
  return new WebSocket(url, ['realness', token])
}
