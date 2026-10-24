/**
 * Realness's own sign-in issuer. Tokens carry the same claims as Firebase's,
 * so `verify_token` checks both; only the issuer and the keys differ.
 */
import {
  createHash as create_hash,
  createPrivateKey as create_private_key,
  createPublicKey as create_public_key,
  createSign as create_sign,
  generateKeyPairSync as generate_key_pair_sync
} from 'node:crypto'
import { MS_PER_SECOND, SECONDS_PER_HOUR } from '#root/lib/units.js'

const KEY = 'key.pem'
const KID_LENGTH = 16
const UID_LENGTH = 24

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')

/** The `iss` claim our tokens carry for a project. */
export const issuer_for = project => `https://sign-in.realness/${project}`

/** One uid per number, stable across restarts and machines. */
export const uid_for = phone =>
  `r-${create_hash('sha256').update(phone).digest('base64url').slice(0, UID_LENGTH)}`

/** The stored signing key, made once on first use. */
const signing_key = async storage => {
  const stored = await storage.get(KEY)
  if (stored) return create_private_key(stored.body)
  const { privateKey } = generate_key_pair_sync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  try {
    await storage.put(KEY, pem, { if_absent: true })
    return privateKey
  } catch {
    const winner = await storage.get(KEY)
    if (!winner) throw new Error('sign-in: no signing key')
    return create_private_key(winner.body)
  }
}

/**
 * @param {{ get: Function, put: Function }} storage Where the signing key lives.
 * @param {{ project: string }} options
 */
export const sign_in_issuer = async (storage, { project }) => {
  const private_key = await signing_key(storage)
  const pem = String(
    create_public_key(private_key).export({ type: 'spki', format: 'pem' })
  )
  const kid = create_hash('sha256')
    .update(pem)
    .digest('hex')
    .slice(0, KID_LENGTH)
  const issuer = issuer_for(project)
  return {
    project,
    issuer,
    certs: () => Promise.resolve({ [kid]: pem }),
    /**
     * @param {string} phone
     * @param {{ lifetime?: number, auth_time?: number }} [options]
     */
    token(phone, { lifetime = SECONDS_PER_HOUR, auth_time } = {}) {
      const now = Math.floor(Date.now() / MS_PER_SECOND)
      const head = b64({ alg: 'RS256', kid, typ: 'JWT' })
      const body = b64({
        aud: project,
        iss: issuer,
        sub: uid_for(phone),
        phone_number: phone,
        iat: now,
        auth_time: auth_time ?? now,
        exp: now + lifetime
      })
      const signer = create_sign('RSA-SHA256')
      signer.update(`${head}.${body}`)
      return `${head}.${body}.${signer.sign(private_key).toString('base64url')}`
    }
  }
}
