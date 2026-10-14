import { check_secret, open_pass, sign_pass } from '#root/src/can/pass.js'

const PHONE = /^\+[1-9]\d{6,14}$/
const ACTOR = /^(a|app)-[a-f0-9]{12}$/
const LIFETIME = 60
const MODEL_PASS = {
  audience: 'brayness-model',
  life_s: LIFETIME,
  name: 'model pass'
}

/** @param {{ phone: string, id: string }} actor */
export const issue_model_pass = (actor, secret, now = Date.now()) => {
  check_secret(secret, 'model pass')
  if (!PHONE.test(actor?.phone) || !ACTOR.test(actor?.id))
    throw new Error('model pass needs a verified owner and actor')
  return sign_pass(
    { aud: MODEL_PASS.audience, phone: actor.phone, id: actor.id },
    secret,
    { life_s: LIFETIME, now }
  )
}

export const verify_model_pass = (pass, secret, now = Date.now()) => {
  const claims = open_pass(pass, secret, { ...MODEL_PASS, now })
  if (!PHONE.test(claims.phone) || !ACTOR.test(claims.id))
    throw new Error('expired or invalid model pass')
  return { phone: claims.phone, id: claims.id }
}
