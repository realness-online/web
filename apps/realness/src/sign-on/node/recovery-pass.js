import { check_secret, open_pass, sign_pass } from '#root/src/can/pass.js'
import { skipped } from '#root/src/files/skip.js'
import { limit_path } from '#root/src/files/paths.js'
import { has_escape, unsafe_part } from '#root/lib/path-parts.js'

/** @param {string} path @param {string[]} paths */
const within_paths = (path, paths) =>
  paths.some(allowed => path === allowed || path.startsWith(`${allowed}/`))

const MAX_PATHS = 100

const PHONE = /^\+[1-9]\d{6,14}$/
const ID = /^a-[a-f0-9]{12}$/
/** hs-f2: the issuing halo, so sync can fence a failed one. Older passes omit it. */
const HALO = /^[a-z0-9][a-z0-9-]{0,62}$/
const NAME = 'recovery pass'
const LIFE_S = 300

export const issue_recovery_pass = (claims, secret, now = Date.now()) =>
  issue_pass(claims, secret, now, 'realness-recovery')
export const issue_harness_pass = (claims, secret, now = Date.now()) =>
  issue_pass(claims, secret, now, 'realness-harness')

/**
 * @param {{ phone: string, id: string, paths?: string[] | null, halo?: string }} claims
 * @param {string} secret
 * @param {number} now
 * @param {string} audience
 */
const issue_pass = (
  { phone, id, paths = null, halo },
  secret,
  now,
  audience
) => {
  if (halo !== undefined && !HALO.test(halo)) throw new Error('bad halo name')
  check_secret(secret, 'recovery')
  if (!PHONE.test(phone) || !ID.test(id))
    throw new Error('recovery needs a verified owner and session')
  if (
    paths !== null &&
    (!Array.isArray(paths) ||
      paths.length > MAX_PATHS ||
      !paths.every(limit_path))
  )
    throw new Error('bad path limit')
  return sign_pass(
    {
      aud: audience,
      phone,
      id,
      ...(paths && { paths }),
      ...(halo && { halo })
    },
    secret,
    { life_s: LIFE_S, now }
  )
}

export const verify_recovery_pass = (pass, secret, now = Date.now()) =>
  verify_pass(pass, secret, now, 'realness-recovery')
export const verify_harness_pass = (pass, secret, now = Date.now()) =>
  verify_pass(pass, secret, now, 'realness-harness')

const verify_pass = (pass, secret, now, audience) => {
  check_secret(secret, 'recovery')
  const claims = open_pass(pass, secret, {
    audience,
    life_s: LIFE_S,
    name: NAME,
    now
  })
  if (!PHONE.test(claims.phone) || !ID.test(claims.id))
    throw new Error(`expired or invalid ${NAME}`)
  if (
    claims.paths !== undefined &&
    (!Array.isArray(claims.paths) || !claims.paths.every(limit_path))
  )
    throw new Error(`bad ${NAME}`)
  const { halo } = claims
  if (halo !== undefined && !HALO.test(halo)) throw new Error(`bad ${NAME}`)
  return {
    phone: claims.phone,
    id: claims.id,
    paths: claims.paths ?? null,
    ...(halo && { halo })
  }
}

/**
 * Write passes reach only the owner's harness and the actor's selected paths.
 * @param {string} path
 * @param {string} phone
 * @param {string[] | null} paths
 */
export const harness_path = (path, phone, paths = null) => {
  const prefix = `people/${phone}/harness/`
  if (!path.startsWith(prefix)) return false
  // sy18: harness files are stored as `.gz`; rights and skips read the plain name
  return recovery_path(
    `people/${phone}/${path.slice(prefix.length).replace(/\.gz$/, '')}`,
    phone,
    paths
  )
}

/**
 * @param {string} path
 * @param {string} phone
 * @param {string[] | null} paths
 */
export const recovery_path = (path, phone, paths = null) => {
  const prefix = `people/${phone}/`
  if (!path.startsWith(prefix)) return false
  const raw = path.slice(prefix.length)
  const rest = raw.startsWith('harness/') ? raw.replace(/\.gz$/, '') : raw
  const parts = rest.split('/')
  if (parts.at(-1) === '') parts.pop()
  if (!parts.length) return paths === null
  const clean = parts.join('/')
  if (
    paths &&
    !within_paths(clean, paths) &&
    !(
      parts[0] === 'harness' &&
      parts.length > 1 &&
      within_paths(parts.slice(1).join('/'), paths)
    )
  )
    return false
  return (
    !skipped(rest) &&
    parts.every(part => !unsafe_part(part) && !has_escape(part))
  )
}
