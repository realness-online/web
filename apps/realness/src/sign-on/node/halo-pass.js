import {
  check_secret,
  open_pass,
  peek_pass,
  sign_pass
} from '#root/src/can/pass.js'

const PHONE = /^\+[1-9]\d{6,14}$/
const HALO = /^[a-z0-9][a-z0-9-]{0,62}$/
const LIFE_S = 300
const HALO_PASS = {
  audience: 'realness-halo',
  life_s: LIFE_S,
  name: 'halo pass'
}
const RECORD_PASS = {
  audience: 'realness-records',
  life_s: LIFE_S,
  name: 'record pass'
}

export const issue_halo_pass = (who, secret, now = Date.now()) => {
  check_secret(secret, 'halo pass')
  if (!PHONE.test(who?.phone))
    throw new Error('halo pass needs a verified phone')
  return sign_pass({ aud: HALO_PASS.audience, phone: who.phone }, secret, {
    life_s: LIFE_S,
    now
  })
}

export const verify_halo_pass = (pass, secret, now = Date.now()) => {
  const claims = open_pass(pass, secret, { ...HALO_PASS, now })
  if (!PHONE.test(claims.phone)) throw new Error('expired or invalid halo pass')
  return { phone: claims.phone }
}

/** The halo named by a record pass, under either claim name. */
const pass_halo = claims => {
  const halo = claims?.halo
  return typeof halo === 'string' && HALO.test(halo) ? halo : null
}

export const issue_record_pass = (halo, secret, now = Date.now()) => {
  check_secret(secret, 'halo pass')
  if (!HALO.test(halo ?? '')) throw new Error('record pass needs a halo name')
  return sign_pass({ aud: RECORD_PASS.audience, halo }, secret, {
    life_s: LIFE_S,
    now
  })
}

export const record_halo = pass => {
  const claims = peek_pass(pass, 'record pass')
  const halo = claims.aud === RECORD_PASS.audience ? pass_halo(claims) : null
  if (!halo) throw new Error('bad record pass')
  return halo
}

export const verify_record_pass = (pass, secret, now = Date.now()) => {
  const claims = open_pass(pass, secret, { ...RECORD_PASS, now })
  const halo = pass_halo(claims)
  if (!halo) throw new Error('expired or invalid record pass')
  return { halo }
}
