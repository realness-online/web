// b1c/b1d: paid plans and the warning ramp.
//
// A paid plan is one record per person, written only by the proxy when Stripe
// says an invoice is paid:  billing/+A/plan.html
// Model use passes through at cost, so the subscription is the credit: each
// paid invoice resets the credit for the new billing period. Free use keeps
// its token limits; the house model spends only the paid credit.
import { createHmac, timingSafeEqual } from "node:crypto"
import { free_limits } from "./usage.js"

const PHONE = /^\+[1-9]\d{6,14}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const STRIPE = "https://api.stripe.com/v1"
const TOLERANCE_S = 300
/** The ramp: a warning at each step, once per limit per day; 100 is the cutoff. */
export const WARN_AT = [75, 90, 100]
export const PAY_URL = "https://brayness-sign-on.web.app/pay"

export const billing_key = (phone) => `billing/${phone}/plan.html`

const escape = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
const PLAN_FIELDS = ["status", "credit", "start", "end", "subscription", "customer", "invoice"]

/** A plan as one `/plan` item. */
export function plan_html(plan) {
  const props = PLAN_FIELDS.map((name) => `<meta itemprop="${name}" content="${escape(plan[name] ?? "")}">`).join("")
  return `<article itemscope itemtype="/plan">${props}</article>\n`
}

export function read_plan(html) {
  const item = html.match(/<article itemscope itemtype="\/plan">.*?<\/article>/s)?.[0]
  if (!item) return null
  const plan = {}
  for (const [, name, value] of item.matchAll(/itemprop="(\w+)" content="([^"]*)"/g)) plan[name] = value.replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
  plan.credit = Number(plan.credit)
  return plan
}

/** Paid now: the period has started and not ended. A canceled plan keeps its period. */
export function paid_now(plan, now = new Date()) {
  if (!plan || !["active", "canceled"].includes(plan.status)) return null
  if (!DAY.test(plan.start ?? "") || !(plan.credit > 0)) return null
  if (now < new Date(`${plan.start}T00:00:00Z`) || now >= new Date(plan.end)) return null
  return plan
}

/** Plan records in storage, cached briefly per instance. */
export function billing_store(storage, { ttl_ms = 30_000 } = {}) {
  const cache = new Map()
  return {
    async get(phone) {
      const hit = cache.get(phone)
      if (hit && hit.at > Date.now() - ttl_ms) return hit.plan
      const page = await storage.get(billing_key(phone))
      const plan = page ? read_plan(page.body.toString("utf8")) : null
      cache.set(phone, { plan, at: Date.now() })
      return plan
    },
    async put(phone, plan) {
      if (!PHONE.test(phone ?? "")) throw new Error("plan needs a phone")
      await storage.put(billing_key(phone), plan_html(plan))
      cache.set(phone, { plan: read_plan(plan_html(plan)), at: Date.now() })
    },
  }
}

/** What limits a person has now: free always, paid while a period runs. */
export const plan_source = (billing, env = {}) => {
  const free = free_limits(env)
  return async (phone, now = new Date()) => ({ free, paid: paid_now(await billing.get(phone), now) })
}

// --- Stripe, over plain fetch ---

/** Stripe's form encoding, with nested keys as a[b][c]. */
export function form(params, prefix = "", out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key
    if (value == null) continue
    if (typeof value === "object") form(value, name, out)
    else out.append(name, String(value))
  }
  return out
}

export function stripe_api(key, fetcher = fetch) {
  if (!key) throw new Error("stripe key required")
  const call = async (method, path, params) => {
    const response = await fetcher(`${STRIPE}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, ...(params ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
      body: params ? form(params).toString() : undefined,
    })
    const body = await response.json()
    if (!response.ok) throw new Error(`stripe ${method} ${path}: ${body?.error?.message ?? response.status}`)
    return body
  }
  return { post: (path, params) => call("POST", path, params), get: (path) => call("GET", path) }
}

// The plan's price, found by lookup key so no price id is configured.
export const PRICE_KEY = "brayness-plan-monthly"
export const PLAN = { amount: 500, currency: "usd", interval: "month", name: "Brayness plan" }
export const WEBHOOK_EVENTS = ["invoice.paid", "customer.subscription.deleted"]

/** The plan's price id, looked up once. */
export function price_lookup(stripe, key = PRICE_KEY) {
  let found
  return () => (found ??= stripe.get(`/prices?active=true&lookup_keys[]=${key}`).then(({ data }) => {
    if (!data?.[0]?.id) throw new Error(`no active Stripe price ${key}; run proxy/scripts/stripe-setup.js`)
    return data[0].id
  }).catch((error) => { found = null; throw error }))
}

/** A Checkout Session for the paid plan; returns Stripe's hosted URL. */
export async function checkout(stripe, { phone, price, pay_url = PAY_URL }) {
  if (!PHONE.test(phone ?? "")) throw new Error("checkout needs a phone")
  if (!price) throw new Error("checkout needs a price")
  const session = await stripe.post("/checkout/sessions", {
    mode: "subscription",
    line_items: { 0: { price, quantity: 1 } },
    client_reference_id: phone,
    metadata: { phone },
    subscription_data: { metadata: { phone } },
    success_url: `${pay_url}?paid=1`,
    cancel_url: pay_url,
  })
  return { url: session.url }
}

/** Checks the `Stripe-Signature` header against the raw body. */
export function verify_stripe(raw, header, secret, now = Date.now()) {
  if (!secret) throw new Error("webhook secret required")
  const parts = Object.groupBy(String(header ?? "").split(",").map((part) => part.split("=")), ([name]) => name)
  const time = Number(parts.t?.[0]?.[1])
  if (!Number.isSafeInteger(time) || Math.abs(now / 1000 - time) > TOLERANCE_S) throw new Error("stale or missing signature")
  const expected = createHmac("sha256", secret).update(`${time}.${raw}`).digest()
  const ok = (parts.v1 ?? []).some(([, value]) => {
    const actual = Buffer.from(value ?? "", "hex")
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })
  if (!ok) throw new Error("bad signature")
  return JSON.parse(raw)
}

const day_of = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10)
const iso_of = (seconds) => new Date(seconds * 1000).toISOString()

/** The billing period on a subscription, old or new API shape. */
function period(subscription) {
  const item = subscription.items?.data?.[0] ?? {}
  const start = subscription.current_period_start ?? item.current_period_start
  const end = subscription.current_period_end ?? item.current_period_end
  if (!start || !end) throw new Error("subscription has no period")
  return { start: day_of(start), end: iso_of(end) }
}

const subscription_of = (invoice) =>
  invoice.subscription?.id ?? invoice.subscription ?? invoice.parent?.subscription_details?.subscription ?? null

/**
 * Applies one verified Stripe event. A paid invoice tops the credit up to the
 * amount paid for the new period; a deleted subscription keeps what is paid.
 * Returns what changed, or null for events it ignores.
 */
export async function apply_event(event, { stripe, billing }) {
  const object = event?.data?.object ?? {}
  if (event?.type === "invoice.paid") {
    const id = subscription_of(object)
    if (!id) return null
    const subscription = await stripe.get(`/subscriptions/${id}`)
    const phone = subscription.metadata?.phone
    if (!PHONE.test(phone ?? "")) throw new Error("subscription has no phone")
    const plan = { status: "active", credit: object.amount_paid / 100, ...period(subscription), subscription: id, customer: subscription.customer, invoice: object.id }
    await billing.put(phone, plan)
    return { phone, ...plan }
  }
  if (event?.type === "customer.subscription.deleted") {
    const phone = object.metadata?.phone
    if (!PHONE.test(phone ?? "")) return null
    const plan = await billing.get(phone)
    if (!plan || plan.subscription !== object.id) return null
    await billing.put(phone, { ...plan, status: "canceled" })
    return { phone, status: "canceled" }
  }
  return null
}

// --- What a person sees: limits, use, the warning ramp ---

const finite = (n) => (Number.isFinite(n) ? n : null)
const percent = (used, cap) => (Number.isFinite(cap) && cap > 0 ? Math.min(100, Math.floor((used / cap) * 100)) : null)

/**
 * Limits, use, and the one warning worth showing, from `{ free, paid }` and
 * what is spent. Each warning offers a way to pay.
 */
export function limit_status({ free, paid }, { day, month, period }, { pay_url = PAY_URL } = {}) {
  const part = (used, cap) => ({ used: used.tokens, limit: finite(cap.tokens), left: finite(Math.max(0, cap.tokens - used.tokens)), percent: percent(used.tokens, cap.tokens) })
  const status = {
    plan: paid ? "paid" : "free",
    free: { day: part(day, free.day), month: part(month, free.month) },
    paid: paid ? { credit: paid.credit, used: period.cost, left: Math.max(0, paid.credit - period.cost), percent: percent(period.cost, paid.credit), renews: paid.status === "active" ? paid.end : null, ends: paid.end } : null,
    pay_url,
    warn: null,
  }
  // [limit, percent, what is used, when it comes back, the way to pay]
  const parts = [
    status.paid && ["credit", status.paid.percent, "this period's model credit", `it tops up on ${paid.end.slice(0, 10)}`, `Manage your plan at ${pay_url}`],
    ["month", status.free.month.percent, "this month's free model use", "the 1st, UTC", `Subscribe for more at ${pay_url}`],
    ["day", status.free.day.percent, "today's free model use", "midnight UTC", `Subscribe for more at ${pay_url}`],
  ]
  const candidates = parts
    .filter((part) => part && part[1] >= WARN_AT[0])
    .map(([limit, percent, what, back, pay]) => {
      const at = WARN_AT.filter((step) => percent >= step).at(-1)
      const cap = what[0].toUpperCase() + what.slice(1)
      const message = at === 100 ? `${cap} is spent. Model calls stop until ${back}. ${pay}` : `You've used ${percent}% of ${what}.${limit === "credit" ? ` It tops up on ${paid.end.slice(0, 10)}.` : ""} ${pay}`
      return { limit, percent, at, message }
    })
  status.warn = candidates[0] ?? null
  return status
}
