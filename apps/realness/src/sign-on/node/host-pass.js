import {
  check_secret,
  open_pass,
  peek_pass,
  sign_pass
} from '#root/src/can/pass.js'

const PHONE = /^\+[1-9]\d{6,14}$/
const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/
const LIFE_S = 300
const HOST_PASS = {
  audience: 'realness-host',
  life_s: LIFE_S,
  name: 'host pass'
}
const RECORD_PASS = {
  audience: 'realness-records',
  life_s: LIFE_S,
  name: 'record pass'
}

export const issue_host_pass = (who, secret, now = Date.now()) => {
  check_secret(secret, 'host pass')
  if (!PHONE.test(who?.phone))
    throw new Error('host pass needs a verified phone')
  return sign_pass({ aud: HOST_PASS.audience, phone: who.phone }, secret, {
    life_s: LIFE_S,
    now
  })
}

export const verify_host_pass = (pass, secret, now = Date.now()) => {
  const claims = open_pass(pass, secret, { ...HOST_PASS, now })
  if (!PHONE.test(claims.phone)) throw new Error('expired or invalid host pass')
  return { phone: claims.phone }
}

export const issue_record_pass = (host, secret, now = Date.now()) => {
  check_secret(secret, 'host pass')
  if (!HOST.test(host ?? '')) throw new Error('record pass needs a host name')
  return sign_pass({ aud: RECORD_PASS.audience, host }, secret, {
    life_s: LIFE_S,
    now
  })
}

export const record_host = pass => {
  const claims = peek_pass(pass, 'record pass')
  if (claims.aud !== RECORD_PASS.audience || !HOST.test(claims.host ?? ''))
    throw new Error('bad record pass')
  return claims.host
}

export const verify_record_pass = (pass, secret, now = Date.now()) => {
  const claims = open_pass(pass, secret, { ...RECORD_PASS, now })
  if (!HOST.test(claims.host ?? ''))
    throw new Error('expired or invalid record pass')
  return { host: claims.host }
}
