// Short-lived bearer passes signed with the one host secret.
//   host pass     one verified phone, accepted only by hosts
//   record pass   one host, accepted only by sync, for that host's records (o1)
// The audience keeps them apart: neither verifies as the other.
import { createHmac, timingSafeEqual } from "node:crypto"

const PHONE = /^\+[1-9]\d{6,14}$/
const HOST = /^[a-z0-9][a-z0-9-]{0,62}$/
const LIFE_S = 300

function check_secret(secret) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("host pass secret must be at least 32 bytes")
}

function sign(claims, secret, now) {
  const body = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(now / 1000) + LIFE_S })).toString("base64url")
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`
}

/** The claims of a pass with a good signature; its audience is checked by the caller. */
function open(pass, secret, now) {
  const parts = typeof pass === "string" ? pass.split(".") : []
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("bad host pass")
  const [body, signature] = parts
  const expected = createHmac("sha256", secret).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("bad host pass")
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  if (!Number.isSafeInteger(claims.exp) || claims.exp <= now / 1000 || claims.exp > now / 1000 + LIFE_S) throw new Error("expired or invalid host pass")
  return claims
}

export function issue_host_pass(who, secret, now = Date.now()) {
  check_secret(secret)
  if (!PHONE.test(who?.phone)) throw new Error("host pass needs a verified phone")
  return sign({ aud: "brayness-host", phone: who.phone }, secret, now)
}

export function verify_host_pass(pass, secret, now = Date.now()) {
  check_secret(secret)
  const claims = open(pass, secret, now)
  if (claims.aud !== "brayness-host" || !PHONE.test(claims.phone)) throw new Error("expired or invalid host pass")
  return { phone: claims.phone }
}

export function issue_record_pass(host, secret, now = Date.now()) {
  check_secret(secret)
  if (!HOST.test(host ?? "")) throw new Error("record pass needs a host name")
  return sign({ aud: "brayness-records", host }, secret, now)
}

// An untrusted name for finding the verifier; never use it for authorization.
export function record_host(pass) {
  const parts = typeof pass === "string" ? pass.split(".") : []
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("bad record pass")
  const claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"))
  if (claims.aud !== "brayness-records" || !HOST.test(claims.host ?? "")) throw new Error("bad record pass")
  return claims.host
}

export function verify_record_pass(pass, secret, now = Date.now()) {
  check_secret(secret)
  const claims = open(pass, secret, now)
  if (claims.aud !== "brayness-records" || !HOST.test(claims.host ?? "")) throw new Error("expired or invalid record pass")
  return { host: claims.host }
}
