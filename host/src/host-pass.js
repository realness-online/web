// Sync's five-minute bearer pass: issue and verify it in one place.
//
// The sync service mints these for a signed-in phone; a host client with the
// host secret mints its own, which is why issuing lives here beside the check
// (host/test/host-pass.test.js pins the two issuers to the same format).
import { createHmac, timingSafeEqual } from "node:crypto"

const PHONE = /^\+[1-9]\d{6,14}$/
const LIFETIME = 300

export function issue_host_pass(who, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("host pass secret must be at least 32 bytes")
  if (!PHONE.test(who?.phone)) throw new Error("host pass needs a verified phone")
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: who.phone, exp: Math.floor(now / 1000) + LIFETIME })).toString("base64url")
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

export function verify_host_pass(pass, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("host pass secret must be at least 32 bytes")
  const parts = typeof pass === "string" ? pass.split(".") : []
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) throw new Error("bad host pass")
  const [body, signature] = parts
  const expected = createHmac("sha256", secret).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("bad host pass")
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  if (claims.aud !== "brayness-host" || !PHONE.test(claims.phone) || !Number.isSafeInteger(claims.exp) || claims.exp <= now / 1000 || claims.exp > now / 1000 + LIFETIME) throw new Error("expired or invalid host pass")
  return { phone: claims.phone }
}
