// A signed browser cookie and one-use, actor-bound WebSocket tickets.
import { createHmac as create_hmac, randomBytes as random_bytes, timingSafeEqual as timing_safe_equal } from "node:crypto"
import { verify_host_pass } from "./host-pass.js"

const COOKIE_AGE = 12 * 60 * 60
const TICKET_AGE = 30 * 1000
const cookie_name = "brayness_terminal"

const signature = (body, secret) => {
  return create_hmac("sha256", secret).update(body).digest("base64url")
}

const verify = (value, secret, now) => {
  const [body, mac, extra] = typeof value === "string" ? value.split(".") : []
  if (extra || !body || !mac || !/^[\w-]+$/.test(body) || !/^[\w-]+$/.test(mac)) return null
  const expected = Buffer.from(signature(body, secret))
  const actual = Buffer.from(mac)
  if (actual.length !== expected.length || !timing_safe_equal(actual, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
    return Number.isSafeInteger(claims.exp) && claims.exp > now ? claims : null
  } catch {
    return null
  }
}

export const terminal_auth = (secret, { now = Date.now } = {}) => {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("terminal signing secret must be at least 32 bytes")
  const tickets = new Map()
  const cookie = (pass) => {
    const { phone } = verify_host_pass(pass, secret, now())
    const body = Buffer.from(JSON.stringify({ phone, exp: now() + COOKIE_AGE * 1000 })).toString("base64url")
    return `${body}.${signature(body, secret)}`
  }
  const owner = (header) => {
    const match = header?.match(new RegExp(`(?:^|;\\s*)${cookie_name}=([^;]+)`))
    const claims = verify(match?.[1], secret, now())
    return /^\+[1-9]\d{6,14}$/.test(claims?.phone) ? claims.phone : null
  }
  const pass = (phone) => {
    const body = Buffer.from(JSON.stringify({ aud: "brayness-host", phone, exp: Math.floor(now() / 1000) + 60 })).toString("base64url")
    return `${body}.${signature(body, secret)}`
  }
  const issue = (phone, actor) => {
    for (const [key, claim] of tickets) if (claim.expires <= now()) tickets.delete(key)
    if (tickets.size >= 10000) throw new Error("too many terminal tickets")
    const ticket = random_bytes(32).toString("base64url")
    tickets.set(ticket, { phone, actor, expires: now() + TICKET_AGE })
    return ticket
  }
  const consume = (ticket, phone, actor) => {
    const claim = tickets.get(ticket)
    tickets.delete(ticket)
    return Boolean(claim && claim.expires > now() && claim.phone === phone && claim.actor === actor)
  }
  return { cookie, owner, issue, consume, pass, cookie_name, cookie_age: COOKIE_AGE }
}
