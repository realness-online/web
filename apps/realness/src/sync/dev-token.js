/**
 * A local token issuer for development and tests. Its key lives in memory
 * only, and only `--dev` or a test ever creates one.
 */
import {
  createSign as create_sign,
  generateKeyPairSync as generate_key_pair_sync
} from 'node:crypto'
import { MS_PER_SECOND, SECONDS_PER_HOUR } from '#root/lib/units.js'

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')

export const dev_issuer = (project = 'brayness-dev') => {
  const { privateKey, publicKey } = generate_key_pair_sync('rsa', {
    modulusLength: 2048
  })
  const pem = publicKey.export({ type: 'spki', format: 'pem' })
  return {
    project,
    certs: () => Promise.resolve({ dev: pem }),
    token(phone, { uid = `dev-${phone}`, lifetime = SECONDS_PER_HOUR } = {}) {
      const now = Math.floor(Date.now() / MS_PER_SECOND)
      const head = b64({ alg: 'RS256', kid: 'dev', typ: 'JWT' })
      const body = b64({
        aud: project,
        iss: `https://securetoken.google.com/${project}`,
        sub: uid,
        phone_number: phone,
        iat: now,
        auth_time: now,
        exp: now + lifetime
      })
      const signer = create_sign('RSA-SHA256')
      signer.update(`${head}.${body}`)
      return `${head}.${body}.${signer.sign(privateKey).toString('base64url')}`
    }
  }
}
