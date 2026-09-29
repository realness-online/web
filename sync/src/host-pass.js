// A short-lived bearer pass for one verified phone, accepted only by hosts.
import { createHmac, timingSafeEqual } from "node:crypto"

export function issue_host_pass(who, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("host pass secret must be at least 32 bytes")
  if (!/^\+[1-9]\d{6,14}$/.test(who?.phone)) throw new Error("host pass needs a verified phone")
  const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone: who.phone, exp: Math.floor(now / 1000) + 300 })).toString("base64url")
  const signature = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${signature}`
}

export function verify_host_pass(pass, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("host pass secret must be at least 32 bytes")
  const parts = typeof pass === "string" ? pass.split(".") : []
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("bad host pass")
  const [body, signature] = parts
  const expected = createHmac("sha256", secret).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("bad host pass")
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  if (claims.aud !== "brayness-host" || !/^\+[1-9]\d{6,14}$/.test(claims.phone) || !Number.isSafeInteger(claims.exp) || claims.exp <= now / 1000 || claims.exp > now / 1000 + 300) throw new Error("expired or invalid host pass")
  return { phone: claims.phone }
}
