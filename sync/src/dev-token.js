/**
 * A local token issuer for development and tests. Its key lives in memory
 * only, and only `--dev` or a test ever creates one.
 */
import { createSign, generateKeyPairSync } from "node:crypto"

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")

export function dev_issuer(project = "brayness-dev") {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  const pem = publicKey.export({ type: "spki", format: "pem" })
  return {
    project,
    certs: async () => ({ dev: pem }),
    token(phone, { uid = `dev-${phone}`, lifetime = 3600 } = {}) {
      const now = Math.floor(Date.now() / 1000)
      const head = b64({ alg: "RS256", kid: "dev", typ: "JWT" })
      const body = b64({
        aud: project,
        iss: `https://securetoken.google.com/${project}`,
        sub: uid,
        phone_number: phone,
        iat: now,
        auth_time: now,
        exp: now + lifetime,
      })
      const signer = createSign("RSA-SHA256")
      signer.update(`${head}.${body}`)
      return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`
    },
  }
}
