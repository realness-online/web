import {
  createHmac as create_hmac,
  timingSafeEqual as timing_safe_equal
} from 'node:crypto'
import { MS_PER_SECOND } from '#root/lib/units.js'

const SECRET_BYTES = 32
const PART = /^[A-Za-z0-9_-]+$/

/** Throws unless the secret is long enough to sign with. */
export const check_secret = (secret, name = 'pass') => {
  if (!secret || Buffer.byteLength(secret) < SECRET_BYTES)
    throw new Error(`${name} secret must be at least ${SECRET_BYTES} bytes`)
}

const mac = (body, secret) =>
  create_hmac('sha256', secret).update(body).digest()

const split = pass => {
  const parts = typeof pass === 'string' ? pass.split('.') : []
  return parts.length === 2 && parts.every(part => PART.test(part))
    ? parts
    : null
}

/**
 * A pass for `claims.aud`, good for `life_s` seconds.
 * @param {{ aud: string } & Record<string, unknown>} claims
 * @param {string} secret
 * @param {{ life_s: number, now?: number }} options
 */
export const sign_pass = (claims, secret, { life_s, now = Date.now() }) => {
  check_secret(secret)
  const body = Buffer.from(
    JSON.stringify({ ...claims, exp: Math.floor(now / MS_PER_SECOND) + life_s })
  ).toString('base64url')
  return `${body}.${mac(body, secret).toString('base64url')}`
}

/**
 * The claims of a pass signed with `secret` for `audience` and still inside
 * `life_s`; a pass claiming a longer life is refused. `name` words the errors.
 * @param {unknown} pass
 * @param {string} secret
 * @param {{ audience: string, life_s: number, name?: string, now?: number }} options
 */
export const open_pass = (
  pass,
  secret,
  { audience, life_s, name = 'pass', now = Date.now() }
) => {
  check_secret(secret, name)
  const parts = split(pass)
  if (!parts) throw new Error(`bad ${name}`)
  const [body, signature] = parts
  const expected = mac(body, secret)
  const actual = Buffer.from(signature, 'base64url')
  if (
    actual.length !== expected.length ||
    actual.toString('base64url') !== signature ||
    !timing_safe_equal(actual, expected)
  )
    throw new Error(`bad ${name}`)
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  const seconds = now / MS_PER_SECOND
  if (
    claims?.aud !== audience ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp <= seconds ||
    claims.exp > seconds + life_s
  )
    throw new Error(`expired or invalid ${name}`)
  return claims
}

/** The claims of a well-formed pass, unverified: for routing, never for trust. */
export const peek_pass = (pass, name = 'pass') => {
  const parts = split(pass)
  if (!parts) throw new Error(`bad ${name}`)
  return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
}

/** Like `open_pass`, but null instead of a throw: for cookies a request may forge. */
export const read_pass = (pass, secret, options) => {
  try {
    return open_pass(pass, secret, options)
  } catch {
    return null
  }
}
