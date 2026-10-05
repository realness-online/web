/**
 * Phone identity: verify a Firebase ID token, then pin its uid to its number.
 *
 * Realness phone sign-in issues the token; Brayness keeps no accounts.
 * A recycled number arrives with a new uid, so the pin refuses it.
 */
import { createPublicKey as create_public_key, createVerify as create_verify } from "node:crypto"

export const GOOGLE_CERTS =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
const PHONE = /^\+[1-9]\d{6,14}$/
const SKEW = 60 // seconds our clock may run behind Google's

const base64url = (text) => Buffer.from(text, "base64url")
const json = (text) => JSON.parse(base64url(text).toString("utf8"))

/** Fetch Google's signing certificates, cached until they say to refetch. */
export const google_certs = (fetcher = fetch) => {
  let cached = null
  let until = 0
  return async () => {
    if (cached && Date.now() < until) return cached
    const response = await fetcher(GOOGLE_CERTS)
    if (!response.ok) throw new Error(`certs: ${response.status}`)
    const age = Number(/max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1] ?? 0)
    cached = await response.json()
    until = Date.now() + age * 1000
    return cached
  }
}

/**
 * The verified `{ uid, phone }` behind a token, or a throw.
 * `certs` resolves to `{ kid: pem }`; `now` is seconds since the epoch.
 */
export const verify_token = async (token, { project, certs, now = Date.now() / 1000 }) => {
  if (!project) throw new Error("token: no project")
  const parts = typeof token === "string" ? token.split(".") : []
  if (parts.length !== 3) throw new Error("token: not a JWT")
  const [head, body, signature] = parts
  const header = json(head)
  const claims = json(body)
  if (header.alg !== "RS256") throw new Error("token: wrong algorithm")
  const keys = await certs()
  if (!Object.hasOwn(keys, header.kid)) throw new Error("token: unknown key")
  const verifier = create_verify("RSA-SHA256")
  verifier.update(`${head}.${body}`)
  if (!verifier.verify(create_public_key(keys[header.kid]), base64url(signature))) {
    throw new Error("token: bad signature")
  }

  if (claims.aud !== project) throw new Error("token: wrong audience")
  if (claims.iss !== `https://securetoken.google.com/${project}`) throw new Error("token: wrong issuer")
  if (!(claims.exp > now)) throw new Error("token: expired")
  if (!(claims.iat <= now + SKEW)) throw new Error("token: issued in the future")
  if (!(claims.auth_time <= now + SKEW)) throw new Error("token: signed in in the future")
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) throw new Error("token: no uid")
  if (!PHONE.test(claims.phone_number ?? "")) throw new Error("token: no phone number")
  return { uid: claims.sub, phone: claims.phone_number }
}

/**
 * Pin each uid to one number. `pins.claim(phone, uid)` stores the uid only if
 * the number has none (a create-if-absent put) and resolves to the pinned uid.
 */
export const pin = async (identity, pins) => {
  const pinned = await pins.claim(identity.phone, identity.uid)
  if (pinned !== identity.uid) throw new Error("identity: number belongs to another uid")
  return { phone: identity.phone }
}

/** A token in, a `can()` subject out: `{ phone }`. Throws on anything doubtful. */
export const identify = async (token, { pins, ...options }) => {
  return pin(await verify_token(token, options), pins)
}
