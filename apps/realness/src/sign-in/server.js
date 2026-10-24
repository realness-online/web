/**
 * Sign-in by text code. Locally the code goes to the log; a sender replaces
 * `deliver` when this grows past one Mac.
 */
import {
  createHash as create_hash,
  randomBytes as random_bytes,
  randomInt as random_int,
  timingSafeEqual as timing_safe_equal
} from 'node:crypto'
import { MS_PER_MINUTE } from '#root/lib/units.js'
import { HTTP } from '#root/lib/http.js'

const PHONE = /^\+[1-9]\d{6,14}$/
const CODE_DIGITS = 6
const CODE_SPACE = 1_000_000
const CODE_MINUTES = 10
const CODE_LIFETIME_MS = CODE_MINUTES * MS_PER_MINUTE
const CODE_TRIES = 5
const MAX_BODY = 4096
const REFRESH_BYTES = 32

const hash = text => create_hash('sha256').update(text).digest('base64url')
const session_key = refresh => `sessions/${hash(refresh)}.json`

const same = (a, b) =>
  a.length === b.length && timing_safe_equal(Buffer.from(a), Buffer.from(b))

const reply = (response, status, body) => {
  const text = body === undefined ? '' : JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store'
  })
  response.end(text)
}

const read_json = request =>
  new Promise(resolve => {
    let size = 0
    const chunks = []
    request.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY) return request.destroy()
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(null)
      }
    })
    request.on('error', () => resolve(null))
  })

/**
 * @param {{
 *   issuer: Awaited<ReturnType<typeof import('./issuer.js').sign_in_issuer>>,
 *   storage: { get: Function, put: Function, delete: Function },
 *   deliver: (phone: string, code: string) => void | Promise<void>,
 *   now?: () => number
 * }} options
 */
export const sign_in_handler = ({
  issuer,
  storage,
  deliver,
  now = Date.now
}) => {
  /** @type {Map<string, { code: string, until: number, tries: number }>} */
  const codes = new Map()

  const fresh_token = phone => ({ id_token: issuer.token(phone), phone })

  const routes = {
    'GET /health': (_, response) => reply(response, HTTP.OK, { ok: true }),

    'GET /certs': async (_, response) =>
      reply(response, HTTP.OK, await issuer.certs()),

    async 'POST /code'(request, response) {
      const body = await read_json(request)
      const phone = body?.phone
      if (!PHONE.test(phone ?? ''))
        return reply(response, HTTP.BAD_REQUEST, { error: 'phone' })
      const code = String(random_int(CODE_SPACE)).padStart(CODE_DIGITS, '0')
      codes.set(phone, { code, until: now() + CODE_LIFETIME_MS, tries: 0 })
      await deliver(phone, code)
      reply(response, HTTP.ACCEPTED, { sent: true })
    },

    async 'POST /token'(request, response) {
      const body = await read_json(request)
      const phone = body?.phone ?? ''
      const pending = codes.get(phone)
      if (!pending || pending.until < now())
        return reply(response, HTTP.UNAUTHORIZED, { error: 'code' })
      pending.tries += 1
      if (pending.tries > CODE_TRIES) codes.delete(phone)
      if (
        pending.tries > CODE_TRIES ||
        !same(String(body.code ?? ''), pending.code)
      )
        return reply(response, HTTP.UNAUTHORIZED, { error: 'code' })
      codes.delete(phone)
      const refresh_token = random_bytes(REFRESH_BYTES).toString('base64url')
      await storage.put(
        session_key(refresh_token),
        JSON.stringify({ phone, started: now() })
      )
      reply(response, HTTP.OK, { ...fresh_token(phone), refresh_token })
    },

    async 'POST /refresh'(request, response) {
      const body = await read_json(request)
      const refresh = String(body?.refresh_token ?? '')
      const session = refresh ? await storage.get(session_key(refresh)) : null
      if (!session)
        return reply(response, HTTP.UNAUTHORIZED, { error: 'session' })
      const { phone } = JSON.parse(session.body.toString('utf8'))
      reply(response, HTTP.OK, fresh_token(phone))
    },

    async 'POST /sign-out'(request, response) {
      const body = await read_json(request)
      const refresh = String(body?.refresh_token ?? '')
      if (refresh) await storage.delete(session_key(refresh))
      reply(response, HTTP.NO_CONTENT)
    }
  }

  /** @type {import('node:http').RequestListener} */
  return async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://sign-in').pathname
    const route = routes[`${request.method} ${path}`]
    if (!route) return reply(response, HTTP.NOT_FOUND, { error: 'not found' })
    try {
      await route(request, response)
    } catch (error) {
      console.error(`sign-in: ${error.message}`)
      if (!response.headersSent)
        reply(response, HTTP.INTERNAL_ERROR, { error: 'sign-in' })
    }
  }
}
