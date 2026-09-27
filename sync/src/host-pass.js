// A short-lived bearer pass for one verified phone, accepted only by hosts.
import { createHmac } from "node:crypto"

export function issue_host_pass(who, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("host pass secret must be at least 32 bytes")
  if (!/^\+[1-9]\d{6,14}$/.test(who?.phone)) throw new Error("host pass needs a verified phone")
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: who.phone, exp: Math.floor(now / 1000) + 300 })).toString("base64url")
  const signature = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${signature}`
}
