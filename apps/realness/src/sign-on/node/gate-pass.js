import { check_secret, open_pass, sign_pass } from '#root/src/can/pass.js'

/**
 * The gate's pass to sync. The gate holds no bucket access; sync's own rules
 * let this pass read and write only the woken host's lifecycle record and
 * the placement records.
 */
const AUDIENCE = 'realness-gate'
const NAME = 'gate pass'
const LIFE_S = 300
const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/

/** @param {string} host the one host this gate may wake */
export const issue_gate_pass = (host, secret, now = Date.now()) => {
  check_secret(secret, NAME)
  if (!HOST.test(host)) throw new Error('bad host name')
  return sign_pass({ aud: AUDIENCE, gate: host }, secret, {
    life_s: LIFE_S,
    now
  })
}

/** @returns {{ gate: string }} */
export const verify_gate_pass = (pass, secret, now = Date.now()) => {
  const claims = open_pass(pass, secret, {
    audience: AUDIENCE,
    life_s: LIFE_S,
    name: NAME,
    now
  })
  if (!HOST.test(claims.gate)) throw new Error(`bad ${NAME}`)
  return { gate: claims.gate }
}
