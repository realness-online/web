/**
 * Hands a finished sign-in to a terminal on this computer (`brayness login`).
 *
 * The terminal listens on 127.0.0.1 and opens /sign-on?cli=<port>&state=<s>.
 * After the person confirms, this posts the refresh token there with the same
 * state. A top-level form POST, not fetch: nothing lands in history, and a
 * page navigation to loopback needs no local-network permission.
 */

const PORT = /^\d{2,5}$/
const STATE = /^[A-Za-z0-9_-]{32,128}$/
/** Unprivileged ports only: a terminal never listens below these. */
const FIRST_PORT = 1024
const LAST_PORT = 65535

/**
 * The terminal asking for a sign-in, or null when the query is not one.
 * @param {Record<string, unknown> | undefined} query
 * @returns {{ port: number, state: string } | null}
 */
export const cli_request = query => {
  const port = query?.cli
  const state = query?.state
  if (typeof port !== 'string' || !PORT.test(port)) return null
  if (typeof state !== 'string' || !STATE.test(state)) return null
  const number = Number(port)
  if (number < FIRST_PORT || number > LAST_PORT) return null
  return { port: number, state }
}

/**
 * Post the sign-in to the waiting terminal. Leaves this page.
 * @param {{ port: number, state: string }} request
 * @param {{ refresh_token: string, api_key: string }} credentials
 * @param {Document} [doc]
 */
export const hand_off = (request, credentials, doc = document) => {
  const form = doc.createElement('form')
  form.method = 'POST'
  form.action = `http://127.0.0.1:${request.port}/callback`
  form.hidden = true
  const fields = { state: request.state, ...credentials }
  for (const [name, value] of Object.entries(fields)) {
    const input = doc.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  }
  doc.body.append(form)
  form.submit()
}
