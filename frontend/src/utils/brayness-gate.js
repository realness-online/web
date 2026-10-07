/* r2: sessions go through the gate, never a host. The gate checks the
   Firebase token, then talks to the person's host under a short host pass.
   Hosting cannot carry WebSockets, so the gate keeps its own address. */

const gate_url = () => {
  const url = import.meta.env.VITE_BRAYNESS_GATE_URL
  if (!url) throw new Error('Brayness is not configured')
  return url.replace(/\/$/, '')
}

/** A refusal the caller can tell apart from a dropped network. */
const UNAUTHORIZED = 401
const refused = (status, message) =>
  Object.assign(new Error(message), { status })

/** One host API call through the gate; resolves to the response, or throws. */
export const gate_fetch = async (user, path, init = {}) => {
  const response = await fetch(`${gate_url()}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${await user.getIdToken()}`
    }
  })
  if (!response.ok)
    throw refused(response.status, `Brayness answered ${response.status}`)
  return response
}

/** One host API call through the gate; resolves to its JSON. */
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

/** A terminal socket to `actor`; the token rides as the second subprotocol. */
export const open_terminal = async (user, actor, { cols, rows }) => {
  const token = await user.getIdToken()
  if (!token) throw refused(UNAUTHORIZED, 'sign in first')
  const url = new URL(`${gate_url()}/pty`)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  url.search = new URLSearchParams({ actor, cols, rows }).toString()
  return new WebSocket(url, ['brayness', token])
}
