// Verify sync's five-minute bearer pass without accepting a phone from the caller.
import { createHmac, timingSafeEqual } from "node:crypto"

export function verify_host_pass(pass, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("host pass secret must be at least 32 bytes")
  const parts = typeof pass === "string" ? pass.split(".") : []
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) throw new Error("bad host pass")
  const [body, signature] = parts
  const expected = createHmac("sha256", secret).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("bad host pass")
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  if (claims.aud !== "brayness-host" || !/^\+[1-9]\d{6,14}$/.test(claims.phone) || !Number.isSafeInteger(claims.exp) || claims.exp <= now / 1000 || claims.exp > now / 1000 + 300) throw new Error("expired or invalid host pass")
  return { phone: claims.phone }
}
