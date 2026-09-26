/**
 * Live check against Google: every signing certificate parses.
 * With TOKEN set, also verify a real Realness phone token:
 *
 *   TOKEN=<id token> PROJECT=<firebase project> npm run check:google
 */
import { createPublicKey } from "node:crypto"
import { google_certs, verify_token } from "../src/identity.js"

const certs = google_certs()
for (const [kid, pem] of Object.entries(await certs())) {
  console.log(`${kid}: ${createPublicKey(pem).asymmetricKeyType}`)
}

const { TOKEN, PROJECT } = process.env
if (TOKEN) {
  const { phone } = await verify_token(TOKEN, { project: PROJECT, certs })
  console.log(`token verified for ${phone.slice(0, 4)}…${phone.slice(-2)}`)
}
