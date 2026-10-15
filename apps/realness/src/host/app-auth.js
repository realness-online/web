import { randomBytes as random_bytes } from 'node:crypto'
import { check_secret, read_pass, sign_pass } from '#root/src/can/pass.js'
import { MS_PER_SECOND, SECONDS_PER_HOUR } from '#root/lib/units.js'

const COOKIE_HOURS = 12
const TICKET_SECONDS = 30
const MAX_TICKETS = 10_000
const TICKET_BYTES = 32

const COOKIE = 'realness_app'
export const ENTER = '/.realness/enter'
const COOKIE_AGE = COOKIE_HOURS * SECONDS_PER_HOUR
const TICKET_AGE = TICKET_SECONDS * MS_PER_SECOND
const PHONE = /^\+[1-9]\d{6,14}$/
const APP_COOKIE = {
  audience: 'realness-app',
  life_s: COOKIE_AGE,
  name: 'app cookie'
}

export const app_auth = (secret, { now = Date.now } = {}) => {
  check_secret(secret, 'app signing')
  const tickets = new Map()

  const issue = (phone, app) => {
    for (const [key, claim] of tickets)
      if (claim.expires <= now()) tickets.delete(key)
    if (tickets.size >= MAX_TICKETS) throw new Error('too many app tickets')
    const ticket = random_bytes(TICKET_BYTES).toString('base64url')
    tickets.set(ticket, { phone, app, expires: now() + TICKET_AGE })
    return ticket
  }

  /** A good ticket for this app becomes a Set-Cookie value; anything else is null. */
  const enter = (ticket, app) => {
    const claim = tickets.get(ticket)
    tickets.delete(ticket)
    if (!claim || claim.expires <= now() || claim.app !== app) return null
    const value = sign_pass(
      { aud: APP_COOKIE.audience, phone: claim.phone, app },
      secret,
      { life_s: COOKIE_AGE, now: now() }
    )
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
export const withoutAppCookie = header => {
  const rest = (header ?? '')
    .split(/;\s*/)
    .filter(part => part && !part.startsWith(`${COOKIE}=`))
  return rest.length ? rest.join('; ') : undefined
}
