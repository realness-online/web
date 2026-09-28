// u6: private apps. The owner trades a host pass for a one-use, app-bound
// ticket; opening it on the app's own host sets a signed, host-only cookie.
// The proxy strips that cookie, so an app never holds its owner's credential.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const COOKIE = "brayness_app"
export const ENTER = "/.brayness/enter"
const COOKIE_AGE = 12 * 60 * 60
const TICKET_AGE = 30 * 1000
const PHONE = /^\+[1-9]\d{6,14}$/

export function app_auth(secret, { now = Date.now } = {}) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("app signing secret must be at least 32 bytes")
  const sign = (body) => createHmac("sha256", secret).update(`app:${body}`).digest("base64url")
  const tickets = new Map()

  const issue = (phone, app) => {
    for (const [key, claim] of tickets) if (claim.expires <= now()) tickets.delete(key)
    if (tickets.size >= 10000) throw new Error("too many app tickets")
    const ticket = randomBytes(32).toString("base64url")
    tickets.set(ticket, { phone, app, expires: now() + TICKET_AGE })
    return ticket
  }

  /** A good ticket for this app becomes a Set-Cookie value; anything else is null. */
  const enter = (ticket, app) => {
    const claim = tickets.get(ticket)
    tickets.delete(ticket)
    if (!claim || claim.expires <= now() || claim.app !== app) return null
    const body = Buffer.from(JSON.stringify({ phone: claim.phone, app, exp: now() + COOKIE_AGE * 1000 })).toString("base64url")
    return `${COOKIE}=${body}.${sign(body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_AGE}`
  }

  /** The phone a request's cookie names for this app, or null. */
  const owner = (header, app) => {
    const value = header?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1]
    const [body, mac, extra] = value?.split(".") ?? []
    if (extra || !body || !mac) return null
    const expected = Buffer.from(sign(body))
    const actual = Buffer.from(mac)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    try {
      const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
      return claims.app === app && claims.exp > now() && PHONE.test(claims.phone) ? claims.phone : null
    } catch {
      return null
    }
  }

  return { issue, enter, owner }
}

/** The Cookie header without ours; undefined when nothing else is left. */
export function withoutAppCookie(header) {
  const rest = (header ?? "").split(/;\s*/).filter((part) => part && !part.startsWith(`${COOKIE}=`))
  return rest.length ? rest.join("; ") : undefined
}
