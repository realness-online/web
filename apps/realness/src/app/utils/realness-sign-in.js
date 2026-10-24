/**
 * Realness's own sign-in in the browser. It offers the slice of Firebase's
 * auth the app uses: a user with `uid`, `phoneNumber`, and `getIdToken()`,
 * and a sign-in whose result has `confirm(code)`.
 */
const SESSION = 'realness_session'
const RENEW_MARGIN_MS = 60_000
const MS_PER_SECOND = 1000
const NO_CONTENT = 204

/** @typedef {{ uid: string, phoneNumber: string, getIdToken: () => Promise<string> }} SignedIn */

const claims = token =>
  JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))

/** @param {string} base Where the sign-in service answers, e.g. `/sign-in`. */
export const realness_sign_in = base => {
  /** @type {Set<(user: SignedIn | null) => void>} */
  const listeners = new Set()
  let id_token = ''

  const post = async (path, body) => {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!response.ok) throw new Error(`sign-in ${path}: ${response.status}`)
    return response.status === NO_CONTENT ? null : response.json()
  }

  const stored = () => {
    try {
      return JSON.parse(localStorage.getItem(SESSION) ?? 'null')
    } catch {
      return null
    }
  }

  const fresh = token =>
    Boolean(token) &&
    claims(token).exp * MS_PER_SECOND - RENEW_MARGIN_MS > Date.now()

  const get_id_token = async () => {
    if (fresh(id_token)) return id_token
    const session = stored()
    if (!session) throw new Error('signed out')
    ;({ id_token } = await post('/refresh', {
      refresh_token: session.refresh_token
    }))
    return id_token
  }

  /** @returns {SignedIn | null} */
  const user = () => {
    const session = stored()
    if (!session) return null
    return {
      uid: session.uid,
      phoneNumber: session.phone,
      getIdToken: get_id_token
    }
  }

  const announce = () => {
    const current = user()
    for (const listener of listeners) listener(current)
  }

  return {
    /** Fires now with the current user, then on every change. */
    on_change(listener) {
      listeners.add(listener)
      listener(user())
      return () => listeners.delete(listener)
    },

    /** Sends a code; resolves to something whose `confirm(code)` signs in. */
    async sign_in(typed) {
      /** The form sends `+1(628) 228-1824`; Firebase took that, so strip it here. */
      const phone = typed.replace(/[^\d+]/g, '')
      await post('/code', { phone })
      return {
        confirm: async code => {
          const reply = await post('/token', { phone, code })
          ;({ id_token } = reply)
          localStorage.setItem(
            SESSION,
            JSON.stringify({
              phone,
              uid: claims(id_token).sub,
              refresh_token: reply.refresh_token
            })
          )
          announce()
        }
      }
    },

    async sign_out() {
      const session = stored()
      localStorage.removeItem(SESSION)
      id_token = ''
      announce()
      if (session)
        await post('/sign-out', { refresh_token: session.refresh_token }).catch(
          () => {}
        )
    }
  }
}
