import {
  createHmac as create_hmac,
  timingSafeEqual as timing_safe_equal
} from 'node:crypto'
import { free_limits } from './usage.js'
import { person_settings } from '#root/src/settings/environments.js'
import { ISO_DATE, MS_PER_SECOND, PERCENT } from '#root/lib/units.js'
import { item_html, read_item } from '#root/lib/items.js'

const FIRST_WARNING = 75
const CACHE_MS = 30_000
const CENTS = 100

const PHONE = /^\+[1-9]\d{6,14}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const STRIPE = 'https://api.stripe.com/v1'
const TOLERANCE_S = 300
/** The ramp: a warning at each step, once per limit per day; 100 is the cutoff. */
export const WARN_AT = [FIRST_WARNING, 90, PERCENT]
export const PAY_URL = `${person_settings.public_url}/pay`

export const billing_key = phone => `billing/${phone}/plan.html`

const PLAN_FIELDS = [
  'phone',
  'status',
  'credit',
  'start',
  'end',
  'subscription',
  'customer',
  'invoice'
]

/** A plan as one `/plan` item. Its phone is for reading; the key `billing/+A/` decides whose it is. */
export const plan_html = plan =>
  item_html(
    'plan',
    Object.fromEntries(PLAN_FIELDS.map(name => [name, plan[name] ?? '']))
  )

export const read_plan = html => {
  const plan = read_item(html, 'plan')
  if (!plan) return null
  plan.credit = Number(plan.credit)
  return plan
}

/** Paid now: the period has started and not ended. A canceled plan keeps its period. */
export const paid_now = (plan, now = new Date()) => {
  if (!plan || !['active', 'canceled'].includes(plan.status)) return null
  if (!DAY.test(plan.start ?? '') || !(plan.credit > 0)) return null
  if (now < new Date(`${plan.start}T00:00:00Z`) || now >= new Date(plan.end))
    return null
  return plan
}

/** Plan records in storage, cached briefly per instance. */
export const billing_store = (storage, { ttl_ms = CACHE_MS } = {}) => {
  const cache = new Map()
  return {
    async get(phone) {
      const hit = cache.get(phone)
      if (hit && hit.at > Date.now() - ttl_ms) return hit.plan
      const page = await storage.get(billing_key(phone))
      const plan = page ? read_plan(page.body.toString('utf8')) : null
      cache.set(phone, { plan, at: Date.now() })
      return plan
    },
    async put(phone, plan) {
      if (!PHONE.test(phone ?? '')) throw new Error('plan needs a phone')
      const html = plan_html({ ...plan, phone })
      await storage.put(billing_key(phone), html)
      cache.set(phone, { plan: read_plan(html), at: Date.now() })
    }
  }
}

const MS_PER_DAY = 86_400_000

/**
 * An admin grant: house-model credit for a number of days, starting today.
 * It never replaces a Stripe subscription that is still paid.
 * @param {{ get: (phone: string) => Promise<any>, put: (phone: string, plan: object) => Promise<void> }} billing
 * @param {string} phone
 * @param {{ credit: number, days: number, now?: Date }} options
 */
export const grant_plan = async (
  billing,
  phone,
  { credit, days, now = new Date() }
) => {
  if (!PHONE.test(phone ?? '')) throw new Error('grant needs a phone')
  if (!(credit > 0)) throw new Error('--credit must be more than 0 dollars')
  if (!(Number.isInteger(days) && days > 0))
    throw new Error('--days must be a whole number above 0')
  const current = paid_now(await billing.get(phone), now)
  if (current?.subscription)
    throw new Error(
      `${phone} has a paid Stripe subscription until ${current.end}`
    )
  const plan = {
    status: 'active',
    credit,
    start: now.toISOString().slice(0, ISO_DATE),
    end: new Date(now.getTime() + days * MS_PER_DAY).toISOString()
  }
  await billing.put(phone, plan)
  return { phone, ...plan }
}

/** What limits a person has now: free always, paid while a period runs. */
export const plan_source = (billing, env = {}) => {
  const free = free_limits(env)
  return async (phone, now = new Date()) => ({
    free,
    paid: paid_now(await billing.get(phone), now)
  })
}

/** Stripe's form encoding, with nested keys as a[b][c]. */
export const form = (params, prefix = '', out = new URLSearchParams()) => {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key
    if (value === null || value === undefined) continue
    if (typeof value === 'object') form(value, name, out)
    else out.append(name, String(value))
  }
  return out
}

export const stripe_api = (key, fetcher = fetch) => {
  if (!key) throw new Error('stripe key required')
  const call = async (method, path, params) => {
    const response = await fetcher(`${STRIPE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        ...(params
          ? { 'content-type': 'application/x-www-form-urlencoded' }
          : {})
      },
      body: params ? form(params).toString() : undefined
    })
    const body = await response.json()
    if (!response.ok)
      throw new Error(
        `stripe ${method} ${path}: ${body?.error?.message ?? response.status}`
      )
    return body
  }
  return {
    post: (path, params) => call('POST', path, params),
    get: path => call('GET', path)
  }
}

export const PRICE_KEY = 'realness-plan-monthly'
export const PLAN = {
  amount: 500,
  currency: 'usd',
  interval: 'month',
  name: 'Realness plan'
}
export const WEBHOOK_EVENTS = ['invoice.paid', 'customer.subscription.deleted']

/** The plan's price id, looked up once. */
export const price_lookup = (stripe, key = PRICE_KEY) => {
  let found
  return () =>
    (found ??= stripe
      .get(`/prices?active=true&lookup_keys[]=${key}`)
      .then(({ data }) => {
        if (!data?.[0]?.id)
          throw new Error(
            `no active Stripe price ${key}; run server/proxy/scripts/stripe-setup.js`
          )
        return data[0].id
      })
      .catch(error => {
        found = null
        throw error
      }))
}

/** A Checkout Session for the paid plan; returns Stripe's hosted URL. */
export const checkout = async (stripe, { phone, price, pay_url = PAY_URL }) => {
  if (!PHONE.test(phone ?? '')) throw new Error('checkout needs a phone')
  if (!price) throw new Error('checkout needs a price')
  const session = await stripe.post('/checkout/sessions', {
    mode: 'subscription',
    line_items: { 0: { price, quantity: 1 } },
    client_reference_id: phone,
    metadata: { phone },
    subscription_data: { metadata: { phone } },
    success_url: `${pay_url}?paid=1`,
    cancel_url: pay_url
  })
  return { url: session.url }
}

/** Checks the `Stripe-Signature` header against the raw body. */
export const verify_stripe = (raw, header, secret, now = Date.now()) => {
  if (!secret) throw new Error('webhook secret required')
  const parts = Object.groupBy(
    String(header ?? '')
      .split(',')
      .map(part => part.split('=')),
    ([name]) => name
  )
  const time = Number(parts.t?.[0]?.[1])
  if (
    !Number.isSafeInteger(time) ||
    Math.abs(now / MS_PER_SECOND - time) > TOLERANCE_S
  )
    throw new Error('stale or missing signature')
  const expected = create_hmac('sha256', secret)
    .update(`${time}.${raw}`)
    .digest()
  const ok = (parts.v1 ?? []).some(([, value]) => {
    const actual = Buffer.from(value ?? '', 'hex')
    return (
      actual.length === expected.length && timing_safe_equal(actual, expected)
    )
  })
  if (!ok) throw new Error('bad signature')
  return JSON.parse(raw)
}

const day_of = seconds =>
  new Date(seconds * MS_PER_SECOND).toISOString().slice(0, ISO_DATE)
const iso_of = seconds => new Date(seconds * MS_PER_SECOND).toISOString()

/** The billing period on a subscription, old or new API shape. */
const period = subscription => {
  const item = subscription.items?.data?.[0] ?? {}
  const start = subscription.current_period_start ?? item.current_period_start
  const end = subscription.current_period_end ?? item.current_period_end
  if (!start || !end) throw new Error('subscription has no period')
  return { start: day_of(start), end: iso_of(end) }
}

const subscription_of = invoice =>
  invoice.subscription?.id ??
  invoice.subscription ??
  invoice.parent?.subscription_details?.subscription ??
  null

/**
 * Applies one verified Stripe event. A paid invoice tops the credit up to the
 * amount paid for the new period; a deleted subscription keeps what is paid.
 * Returns what changed, or null for events it ignores.
 */
export const apply_event = async (event, { stripe, billing }) => {
  const object = event?.data?.object ?? {}
  if (event?.type === 'invoice.paid') {
    const id = subscription_of(object)
    if (!id) return null
    const subscription = await stripe.get(`/subscriptions/${id}`)
    const phone = subscription.metadata?.phone
    if (!PHONE.test(phone ?? '')) throw new Error('subscription has no phone')
    const plan = {
      status: 'active',
      credit: object.amount_paid / CENTS,
      ...period(subscription),
      subscription: id,
      customer: subscription.customer,
      invoice: object.id
    }
    await billing.put(phone, plan)
    return { phone, ...plan }
  }
  if (event?.type === 'customer.subscription.deleted') {
    const phone = object.metadata?.phone
    if (!PHONE.test(phone ?? '')) return null
    const plan = await billing.get(phone)
    if (!plan || plan.subscription !== object.id) return null
    await billing.put(phone, { ...plan, status: 'canceled' })
    return { phone, status: 'canceled' }
  }
  return null
}

const finite = n => (Number.isFinite(n) ? n : null)
const percent = (used, cap) =>
  Number.isFinite(cap) && cap > 0
    ? Math.min(PERCENT, Math.floor((used / cap) * PERCENT))
    : null

/**
 * Limits, use, and the one warning worth showing, from `{ free, paid }` and
 * what is spent. Each warning offers a way to pay.
 */
export const limit_status = (
  { free, paid },
  { day, month, period },
  { pay_url = PAY_URL } = {}
) => {
  const part = (used, cap) => ({
    used: used.tokens,
    limit: finite(cap.tokens),
    left: finite(Math.max(0, cap.tokens - used.tokens)),
    percent: percent(used.tokens, cap.tokens)
  })
  /**
   * @typedef {{ used: number, limit: number | null, left: number | null, percent: number | null }} SpendPart
   *
   * @type {{ plan: string, free: { day: SpendPart, month: SpendPart }, paid: { credit: number, used: number, left: number, percent: number | null, renews: string | null, ends: string } | null, pay_url: string, warn: { limit: string, percent: number, at: number | undefined, message: string } | null }}
   */
  const status = {
    plan: paid ? 'paid' : 'free',
    free: { day: part(day, free.day), month: part(month, free.month) },
    paid: paid
      ? {
          credit: paid.credit,
          used: period.cost,
          left: Math.max(0, paid.credit - period.cost),
          percent: percent(period.cost, paid.credit),
          renews:
            paid.status === 'active' && paid.subscription ? paid.end : null,
          ends: paid.end
        }
      : null,
    pay_url,
    warn: null
  }
  /**
   * One warning candidate per limit: what to call it, how full it is, how to
   * describe it, when it resets, and how to pay. A null entry is skipped.
   * @type {([string, number | null, string, string, string] | null)[]}
   */
  const parts = [
    status.paid
      ? [
          'credit',
          status.paid.percent,
          "this period's model credit",
          `it tops up on ${paid.end.slice(0, ISO_DATE)}`,
          `Manage your plan at ${pay_url}`
        ]
      : null,
    [
      'month',
      status.free.month.percent,
      "this month's free model use",
      'the 1st, UTC',
      `Subscribe for more at ${pay_url}`
    ],
    [
      'day',
      status.free.day.percent,
      "today's free model use",
      'midnight UTC',
      `Subscribe for more at ${pay_url}`
    ]
  ]
  /** @type {{ limit: string, percent: number, at: number | undefined, message: string }[]} */
  const candidates = []
  for (const part of parts) {
    if (!part) continue
    const [limit, percent, what, back, pay] = part
    if (typeof percent !== 'number' || percent < WARN_AT[0]) continue
    const at = WARN_AT.filter(step => percent >= step).at(-1)
    const cap = what[0].toUpperCase() + what.slice(1)
    const message =
      at === PERCENT
        ? `${cap} is spent. Model calls stop until ${back}. ${pay}`
        : `You've used ${percent}% of ${what}.${limit === 'credit' ? ` It tops up on ${paid.end.slice(0, ISO_DATE)}.` : ''} ${pay}`
    candidates.push({ limit, percent, at, message })
  }
  status.warn = candidates[0] ?? null
  return status
}
