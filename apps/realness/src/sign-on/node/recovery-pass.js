import { check_secret, open_pass, sign_pass } from "#root/src/can/pass.js"
import { skipped } from "#root/src/files/skip.js"
import { limit_path } from "#root/src/files/paths.js"

const PHONE = /^\+[1-9]\d{6,14}$/
const ID = /^a-[a-f0-9]{12}$/
const NAME = "recovery pass"
const LIFE_S = 300

export const issue_recovery_pass = (claims, secret, now = Date.now()) => issue_pass(claims, secret, now, "brayness-recovery")
export const issue_harness_pass = (claims, secret, now = Date.now()) => issue_pass(claims, secret, now, "brayness-harness")

const issue_pass = ({ phone, id, paths = null }, secret, now, audience) => {
  check_secret(secret, "recovery")
  if (!PHONE.test(phone) || !ID.test(id)) throw new Error("recovery needs a verified owner and session")
  if (paths !== null && (!Array.isArray(paths) || paths.length > 100 || !paths.every(limit_path))) throw new Error("bad path limit")
  return sign_pass({ aud: audience, phone, id, ...(paths && { paths }) }, secret, { life_s: LIFE_S, now })
}

export const verify_recovery_pass = (pass, secret, now = Date.now()) => verify_pass(pass, secret, now, "brayness-recovery")
export const verify_harness_pass = (pass, secret, now = Date.now()) => verify_pass(pass, secret, now, "brayness-harness")

const verify_pass = (pass, secret, now, audience) => {
  check_secret(secret, "recovery")
  const claims = open_pass(pass, secret, { audience, life_s: LIFE_S, name: NAME, now })
  if (!PHONE.test(claims.phone) || !ID.test(claims.id)) throw new Error(`expired or invalid ${NAME}`)
  if (claims.paths !== undefined && (!Array.isArray(claims.paths) || !claims.paths.every(limit_path))) throw new Error(`bad ${NAME}`)
  return { phone: claims.phone, id: claims.id, paths: claims.paths ?? null }
}

/** Write passes reach only the owner's harness and the actor's selected paths. */
export const harness_path = (path, phone, paths = null) => {
  const prefix = `people/${phone}/harness/`
  if (!path.startsWith(prefix)) return false
  return recovery_path(`people/${phone}/${path.slice(prefix.length)}`, phone, paths)
}

export const recovery_path = (path, phone, paths = null) => {
  const prefix = `people/${phone}/`
  if (!path.startsWith(prefix)) return false
  const rest = path.slice(prefix.length)
  const parts = rest.split("/")
  if (parts.at(-1) === "") parts.pop()
  if (!parts.length) return paths === null
  const clean = parts.join("/")
  const within = (path) => paths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))
  if (paths && !within(clean) && !(parts[0] === "harness" && parts.length > 1 && within(parts.slice(1).join("/")))) return false
  return !skipped(rest) && parts.every((part) => part && part !== "." && part !== ".." && !/[\\\0]|%[0-9a-f]{2}/i.test(part))
}
