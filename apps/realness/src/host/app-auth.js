import { randomBytes as random_bytes } from "node:crypto"
import { check_secret, read_pass, sign_pass } from "#root/src/can/pass.js"

export const COOKIE = "brayness_app"
export const ENTER = "/.brayness/enter"
const COOKIE_AGE = 12 * 60 * 60
const TICKET_AGE = 30 * 1000
const PHONE = /^\+[1-9]\d{6,14}$/
const APP_COOKIE = { audience: "brayness-app", life_s: COOKIE_AGE, name: "app cookie" }

export const app_auth = (secret, { now = Date.now } = {}) => {
  check_secret(secret, "app signing")
  const tickets = new Map()

  const issue = (phone, app) => {
    for (const [key, claim] of tickets) if (claim.expires <= now()) tickets.delete(key)
    if (tickets.size >= 10000) throw new Error("too many app tickets")
    const ticket = random_bytes(32).toString("base64url")
    tickets.set(ticket, { phone, app, expires: now() + TICKET_AGE })
    return ticket
  }

  /** A good ticket for this app becomes a Set-Cookie value; anything else is null. */
  const enter = (ticket, app) => {
    const claim = tickets.get(ticket)
    tickets.delete(ticket)
    if (!claim || claim.expires <= now() || claim.app !== app) return null
    const value = sign_pass({ aud: APP_COOKIE.audience, phone: claim.phone, app }, secret, { life_s: COOKIE_AGE, now: now() })
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_AGE}`
  }

  /** The phone a request's cookie names for this app, or null. */
  const owner = (header, app) => {
    const value = header?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1]
    const claims = read_pass(value, secret, { ...APP_COOKIE, now: now() })
    return claims?.app === app && PHONE.test(claims.phone) ? claims.phone : null
  }

  return { issue, enter, owner }
}

/** The Cookie header without ours; undefined when nothing else is left. */
export const withoutAppCookie = (header) => {
  const rest = (header ?? "").split(/;\s*/).filter((part) => part && !part.startsWith(`${COOKIE}=`))
  return rest.length ? rest.join("; ") : undefined
}
