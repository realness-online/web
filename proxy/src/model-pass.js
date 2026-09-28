// A short-lived model credential. The actor asks its host for a fresh one
// before each call; the proxy checks expiry when the call starts.
import { createHmac, timingSafeEqual } from "node:crypto"

const PHONE = /^\+[1-9]\d{6,14}$/
const ACTOR = /^a-[a-f0-9]{12}$/
const LIFETIME = 60

/** @param {{ phone: string, id: string }} actor */
export function issue_model_pass(actor, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("model pass secret must be at least 32 bytes")
  if (!PHONE.test(actor?.phone) || !ACTOR.test(actor?.id)) throw new Error("model pass needs a verified owner and actor")
  const body = Buffer.from(JSON.stringify({ aud: "brayness-model", phone: actor.phone, id: actor.id, exp: Math.floor(now / 1000) + LIFETIME })).toString("base64url")
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

export function verify_model_pass(pass, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("model pass secret must be at least 32 bytes")
  const parts = typeof pass === "string" ? pass.split(".") : []
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("bad model pass")
  const [body, signature] = parts
  const expected = createHmac("sha256", secret).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("bad model pass")
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  if (claims.aud !== "brayness-model" || !PHONE.test(claims.phone) || !ACTOR.test(claims.id) || !Number.isSafeInteger(claims.exp) || claims.exp <= now / 1000 || claims.exp > now / 1000 + LIFETIME) throw new Error("expired or invalid model pass")
  return { phone: claims.phone, id: claims.id }
}
