/**
 * Phone identity: verify a Firebase ID token, then pin its uid to its number.
 *
 * Realness phone sign-in issues the token; Realness keeps no accounts.
 * A recycled number arrives with a new uid, so the pin refuses it.
 */
import {
  createPublicKey as create_public_key,
  createVerify as create_verify
} from 'node:crypto'
import { MS_PER_SECOND } from '#root/lib/units.js'

const MAX_SUBJECT = 128

const GOOGLE_CERTS =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const PHONE = /^\+[1-9]\d{6,14}$/
const SKEW = 60

const base64url = text => Buffer.from(text, 'base64url')
const json = text => JSON.parse(base64url(text).toString('utf8'))

/**
 * Signing keys as `{ kid: pem }`, cached for the response's max-age.
 * Google's by default; Realness sign-in passes its own `/certs` URL.
 * @param {typeof fetch} [fetcher]
 * @param {string} [url]
 * @returns {() => Promise<Record<string, string>>}
 */
export const google_certs = (fetcher = fetch, url = GOOGLE_CERTS) => {
  /** @type {Record<string, string> | null} */
  let cached = null
  let until = 0
  return async () => {
    const fresh = cached
    if (fresh && Date.now() < until) return fresh
    const response = await fetcher(url)
    if (!response.ok) throw new Error(`certs: ${response.status}`)
    const age = Number(
      /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1] ??
        0
    )
    /** @type {Record<string, string>} */
    const keys = await response.json()
    cached = keys
    until = Date.now() + age * MS_PER_SECOND
    return keys
  }
}

/**
 * The verified `{ uid, phone }` behind a token, or a throw.
 * `certs` resolves to `{ kid: pem }`; `now` is seconds since the epoch.
 * `issuer` defaults to Firebase's for the project.
 */
export const verify_token = async (
  token,
  {
    project,
    certs,
    issuer = `https://securetoken.google.com/${project}`,
    now = Date.now() / MS_PER_SECOND
  }
) => {
  if (!project) throw new Error('token: no project')
  const parts = typeof token === 'string' ? token.split('.') : []
  if (parts.length !== 3) throw new Error('token: not a JWT')
  const [head, body, signature] = parts
  const header = json(head)
  const claims = json(body)
  if (header.alg !== 'RS256') throw new Error('token: wrong algorithm')
  const keys = await certs()
  if (!Object.hasOwn(keys, header.kid)) throw new Error('token: unknown key')
  const verifier = create_verify('RSA-SHA256')
  verifier.update(`${head}.${body}`)
  if (
    !verifier.verify(create_public_key(keys[header.kid]), base64url(signature))
  )
    throw new Error('token: bad signature')

  if (claims.aud !== project) throw new Error('token: wrong audience')
  if (claims.iss !== issuer) throw new Error('token: wrong issuer')
  if (!(claims.exp > now)) throw new Error('token: expired')
  if (!(claims.iat <= now + SKEW))
    throw new Error('token: issued in the future')
  if (!(claims.auth_time <= now + SKEW))
    throw new Error('token: signed in in the future')
  if (
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    claims.sub.length > MAX_SUBJECT
  )
    throw new Error('token: no uid')
  if (!PHONE.test(claims.phone_number ?? ''))
    throw new Error('token: no phone number')
  return { uid: claims.sub, phone: claims.phone_number }
}

/**
 * Pin each uid to one number. `pins.claim(phone, uid)` stores the uid only if
 * the number has none (a create-if-absent put) and resolves to the pinned uid.
 */
export const pin = async (identity, pins) => {
  const pinned = await pins.claim(identity.phone, identity.uid)
  if (pinned !== identity.uid)
    throw new Error('identity: number belongs to another uid')
  return { phone: identity.phone }
}

/**
 * A token in, a `can()` subject out: `{ phone }`. Throws on anything doubtful.
 * @param {string} token
 * @param {{ pins: object, project: string, certs: () => Promise<object>, issuer?: string, now?: number }} options
 */
export const identify = async (token, { pins, ...options }) =>
  pin(await verify_token(token, options), pins)
