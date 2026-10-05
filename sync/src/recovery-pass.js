// A short-lived, read-only pass for a VM recovering its owner's harness.
import { createHmac as create_hmac, timingSafeEqual as timing_safe_equal } from "node:crypto"
import { skipped } from "./skip.js"

const PHONE = /^\+[1-9]\d{6,14}$/
const ID = /^a-[a-f0-9]{12}$/
const SECRET_BYTES = 32

/** A relative path an actor may be limited to: no traversal, no secrets. */
export const limit_path = (path) =>
  typeof path === "string" && path.length <= 512 && !skipped(path) &&
  path.split("/").every((part) => part && part !== "." && part !== ".." && !/[\\\0]|%[0-9a-f]{2}/i.test(part))

export const issue_recovery_pass = (claims, secret, now = Date.now()) => issue_pass(claims, secret, now, "brayness-recovery")
export const issue_harness_pass = (claims, secret, now = Date.now()) => issue_pass(claims, secret, now, "brayness-harness")

const issue_pass = ({ phone, id, paths = null }, secret, now, audience) => {
  if (!secret || Buffer.byteLength(secret) < SECRET_BYTES) throw new Error("recovery secret must be at least 32 bytes")
  if (!PHONE.test(phone) || !ID.test(id)) throw new Error("recovery needs a verified owner and session")
  if (paths !== null && (!Array.isArray(paths) || paths.length > 100 || !paths.every(limit_path))) throw new Error("bad path limit")
  const claims = { aud: audience, phone, id, exp: Math.floor(now / 1000) + 300, ...(paths && { paths }) }
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const signature = create_hmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${signature}`
}

export const verify_recovery_pass = (pass, secret, now = Date.now()) => verify_pass(pass, secret, now, "brayness-recovery")
export const verify_harness_pass = (pass, secret, now = Date.now()) => verify_pass(pass, secret, now, "brayness-harness")

const verify_pass = (pass, secret, now, audience) => {
  if (!secret || Buffer.byteLength(secret) < SECRET_BYTES) throw new Error("recovery secret must be at least 32 bytes")
  const parts = typeof pass === "string" ? pass.split(".") : []
  if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error("bad recovery pass")
  const [body, signature] = parts
  const expected = create_hmac("sha256", secret).update(body).digest()
  const actual = Buffer.from(signature, "base64url")
  if (actual.length !== expected.length || !timing_safe_equal(actual, expected)) throw new Error("bad recovery pass")
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  if (claims.aud !== audience || !PHONE.test(claims.phone) || !ID.test(claims.id) || !Number.isSafeInteger(claims.exp) || claims.exp <= now / 1000 || claims.exp > now / 1000 + 300) throw new Error("expired or invalid recovery pass")
  if (claims.paths !== undefined && (!Array.isArray(claims.paths) || !claims.paths.every(limit_path))) throw new Error("bad recovery pass")
  return { phone: claims.phone, id: claims.id, paths: claims.paths ?? null }
}

/** Write passes reach only the owner's harness and the actor's selected paths. */
export const harness_path = (path, phone, paths = null) => {
  const prefix = `people/${phone}/harness/`
  if (!path.startsWith(prefix)) return false
  return recovery_path(`people/${phone}/${path.slice(prefix.length)}`, phone, paths)
}

// s1d: a host-vouched actor may read anything under its owner's folder.
export const recovery_path = (path, phone, paths = null) => {
  const prefix = `people/${phone}/`
  if (!path.startsWith(prefix)) return false
  const rest = path.slice(prefix.length)
  const parts = rest.split("/")
  if (parts.at(-1) === "") parts.pop()
  if (!parts.length) return paths === null
  const clean = parts.join("/")
  if (paths && !paths.some((allowed) => clean === allowed || clean.startsWith(`${allowed}/`))) return false
  return !skipped(rest) && parts.every((part) => part && part !== "." && part !== ".." && !/[\\\0]|%[0-9a-f]{2}/i.test(part))
}
