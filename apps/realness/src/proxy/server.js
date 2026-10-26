import { answer_release } from '#root/lib/release.js'
import { createServer as create_server } from 'node:http'
import { timingSafeEqual as timing_safe_equal } from 'node:crypto'
import { ISO_DATE } from '#root/lib/units.js'
import { MODEL, HOUSE_MODEL, call_upstream, read_body } from './agent.js'
import { call_span } from '#root/src/telemetry/otlp.js'
import { verify_model_pass } from './model-pass.js'
import { over_limit, usage_meter } from './usage.js'
import {
  PAY_URL,
  apply_event,
  checkout,
  limit_status,
  verify_stripe
} from './billing.js'
import { HTTP } from '#root/lib/http.js'

const MIN_SECRET_BYTES = 32
const MAX_CLIENT_CHARS = 120
const DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX_REPORT_DAYS = 31

const quota_messages = (pay_url = PAY_URL) => ({
  day: `Today's free model use is spent: quota exceeded. It resets at midnight UTC. Subscribe for more at ${pay_url}`,
  month: `This month's free model use is spent: quota exceeded. It resets on the 1st, UTC. Subscribe for more at ${pay_url}`,
  plan: `The house model needs a paid plan: quota exceeded. Subscribe at ${pay_url}`,
  credit: `This period's model credit is spent: quota exceeded. It tops up when your plan renews; manage it at ${pay_url}`
})
export const QUOTA_MESSAGES = quota_messages()

/** The house model is asked for by name; anything else is the free model. */
export const wants_house = body =>
  /^(house|deepseek)/.test(String(body?.model ?? '').replace(/^realness\//, ''))

/** Bearer: a model pass (actor or app) or a phone ID token. */
const bearer_identity = ({ identify_phone, secret }) => {
  if (!secret || Buffer.byteLength(secret) < MIN_SECRET_BYTES)
    throw new Error('model pass secret must be at least 32 bytes')
  const identify = token => {
    if (typeof token !== 'string') throw new Error('missing bearer')
    if (token.split('.').length === 2) return verify_model_pass(token, secret)
    if (token.split('.').length !== 3) throw new Error('invalid bearer')
    return identify_phone(token)
  }
  return async request => {
    try {
      const who = await identify(
        request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]
      )
      return who?.phone ? who : null
    } catch {
      return null
    }
  }
}

const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

/**
 * One HTTP handler for both local Node and a deployed function.
 * `plan_for(phone)` returns `{ free: { day, month }, paid }` for the payer.
 */
export const agent_handler = ({
  identify_phone,
  secret,
  key,
  fetcher = fetch,
  ledger,
  plan_for,
  pay_url = PAY_URL,
  telemetry,
  recorder,
  warn = console.error
}) => {
  if (!key) throw new Error('upstream key required')
  const who_is = bearer_identity({ identify_phone, secret })
  const messages = quota_messages(pay_url)
  const refuse = (response, limit) =>
    json(response, HTTP.TOO_MANY_REQUESTS, {
      error: {
        code: 429,
        type: 'insufficient_quota',
        limit,
        message: messages[limit]
      }
    })
  /** Which limit a call would break, if any. */
  const limit_for = async (phone, house) => {
    const plan = await plan_for(phone)
    if (!house) return over_limit(await ledger.spent(phone), plan.free)
    if (!plan.paid) return 'plan'
    const { cost } = await ledger.spent_since(phone, plan.paid.start)
    return cost >= plan.paid.credit ? 'credit' : undefined
  }
  return async (request, response) => {
    if (request.method !== 'POST')
      return response.writeHead(HTTP.METHOD_NOT_ALLOWED).end()
    const who = await who_is(request)
    if (!who) return response.writeHead(HTTP.UNAUTHORIZED).end()
    let body, request_bytes
    try {
      if (request.body && !Buffer.isBuffer(request.body)) {
        ;({ body } = request)
        request_bytes = Buffer.byteLength(JSON.stringify(body))
      } else ({ body, size: request_bytes } = await read_body(request))
    } catch {
      return response.writeHead(HTTP.BAD_REQUEST).end()
    }
    const client = String(request.headers['user-agent'] ?? '').slice(
      0,
      MAX_CLIENT_CHARS
    )
    const house = wants_house(body)
    if (house && !(ledger && plan_for)) return refuse(response, 'plan')
    if (ledger && plan_for) {
      let limit
      try {
        limit = await limit_for(who.phone, house)
      } catch (error) {
        warn(`usage unreadable: ${error.message}`)
        return response.writeHead(HTTP.UNAVAILABLE).end()
      }
      if (limit) return refuse(response, limit)
    }
    try {
      const model = house ? HOUSE_MODEL : MODEL
      const started = Date.now()
      const upstream = await call_upstream(body, { key, fetcher, model })
      let latency_ms = 0
      response.writeHead(upstream.status, {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json'
      })
      const meter = usage_meter()
      /** @type {Buffer[]} */
      const heard = []
      if (!upstream.body) throw new Error('upstream answered without a body')
      for await (const chunk of upstream.body) {
        if (!latency_ms) latency_ms = Date.now() - started
        meter.add(chunk)
        if (recorder) heard.push(Buffer.from(chunk))
        response.write(chunk)
      }
      if (!latency_ms) latency_ms = Date.now() - started
      const row = {
        model,
        actor: who.id ?? 'phone',
        payer: who.phone,
        plan: house ? 'paid' : 'free',
        status: upstream.status,
        request_bytes,
        latency_ms,
        client,
        ...meter.finish()
      }
      ledger
        ?.record(who.phone, row)
        .catch(error => warn(`usage not recorded: ${error.message}`))
      telemetry?.(call_span({ row, started }))
      recorder?.(who.phone, {
        at: new Date(started).toISOString(),
        actor: row.actor,
        model,
        status: upstream.status,
        client,
        request: body,
        response: Buffer.concat(heard).toString('utf8')
      }).catch(error => warn(`call not recorded: ${error.message}`))
      response.end()
    } catch (error) {
      if (!response.headersSent) response.writeHead(HTTP.BAD_GATEWAY).end()
      else response.destroy(error)
    }
  }
}

/** GET /limit: the caller's limits, use, and any warning. */
export const limit_handler = ({
  identify_phone,
  secret,
  ledger,
  plan_for,
  pay_url = PAY_URL
}) => {
  const who_is = bearer_identity({ identify_phone, secret })
  return async (request, response) => {
    const who = await who_is(request)
    if (!who) return response.writeHead(HTTP.UNAUTHORIZED).end()
    try {
      const plan = await plan_for(who.phone)
      const [spent, period] = await Promise.all([
        ledger.spent(who.phone),
        plan.paid
          ? ledger.spent_since(who.phone, plan.paid.start)
          : { tokens: 0, cost: 0 }
      ])
      json(
        response,
        HTTP.OK,
        limit_status(plan, { ...spent, period }, { pay_url })
      )
    } catch {
      response.writeHead(HTTP.UNAVAILABLE).end()
    }
  }
}

const operator_gate = secret => {
  const expected = Buffer.from(secret)
  return request => {
    const given = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1]
    if (typeof given !== 'string') return false
    const actual = Buffer.from(given)
    return (
      actual.length === expected.length && timing_safe_equal(actual, expected)
    )
  }
}

const days_ending = (end, count) => {
  const at = new Date(`${end}T00:00:00Z`)
  const days = []
  for (let back = count - 1; back >= 0; back--) {
    const day = new Date(at)
    day.setUTCDate(day.getUTCDate() - back)
    days.push(day.toISOString().slice(0, ISO_DATE))
  }
  return days
}

/**
 * GET /usage?day=YYYY-MM-DD or ?days=N: every person's call rows and totals.
 * An operator reads this with the operator secret, not a phone token.
 */
export const usage_handler = ({ ledger, secret, warn = console.error }) => {
  if (!secret || Buffer.byteLength(secret) < MIN_SECRET_BYTES)
    throw new Error('operator secret must be at least 32 bytes')
  const allowed = operator_gate(secret)
  return async (request, response) => {
    if (request.method !== 'GET')
      return response.writeHead(HTTP.METHOD_NOT_ALLOWED).end()
    if (!allowed(request)) return response.writeHead(HTTP.UNAUTHORIZED).end()
    const query = new URL(request.url ?? '/', 'http://proxy').searchParams
    const end = query.get('day') ?? new Date().toISOString().slice(0, ISO_DATE)
    const count = query.get('days') ? Number(query.get('days')) : 1
    if (!DAY.test(end))
      return json(response, HTTP.BAD_REQUEST, {
        error: 'day must be YYYY-MM-DD'
      })
    if (!Number.isInteger(count) || count < 1 || count > MAX_REPORT_DAYS)
      return json(response, HTTP.BAD_REQUEST, {
        error: `days must be 1 to ${MAX_REPORT_DAYS}`
      })
    try {
      if (count === 1) return json(response, HTTP.OK, await ledger.report(end))
      const days = days_ending(end, count)
      json(response, HTTP.OK, {
        from: days[0],
        to: end,
        days: await ledger.report_days(days)
      })
    } catch (error) {
      warn(`usage report unreadable: ${error.message}`)
      response.writeHead(HTTP.UNAVAILABLE).end()
    }
  }
}

/** POST /pay/checkout: a signed-in person starts a subscription. */
export const checkout_handler = ({
  identify_phone,
  secret,
  stripe,
  price,
  pay_url = PAY_URL
}) => {
  const who_is = bearer_identity({ identify_phone, secret })
  return async (request, response) => {
    if (!stripe || !price)
      return json(response, HTTP.UNAVAILABLE, {
        error: 'payments are not set up'
      })
    const who = await who_is(request)
    if (!who) return response.writeHead(HTTP.UNAUTHORIZED).end()
    try {
      json(
        response,
        HTTP.OK,
        await checkout(stripe, {
          phone: who.phone,
          price: typeof price === 'function' ? await price() : price,
          pay_url
        })
      )
    } catch (error) {
      json(response, HTTP.BAD_GATEWAY, { error: error.message })
    }
  }
}

/** POST /pay/webhook: Stripe tells us an invoice is paid. */
export const webhook_handler =
  ({
    stripe,
    billing,
    webhook_secret,
    warn = console.error,
    log = console.info
  }) =>
  async (request, response) => {
    if (!stripe || !webhook_secret)
      return response.writeHead(HTTP.UNAVAILABLE).end()
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    let event
    try {
      event = verify_stripe(
        Buffer.concat(chunks).toString('utf8'),
        request.headers['stripe-signature'],
        webhook_secret
      )
    } catch {
      return response.writeHead(HTTP.BAD_REQUEST).end()
    }
    try {
      const changed = await apply_event(event, { stripe, billing })
      if (changed) log(`billing: ${event.type} ${changed.status ?? ''}`.trim())
      json(response, HTTP.OK, { received: true })
    } catch (error) {
      warn(`billing event ${event.type} failed: ${error.message}`)
      response.writeHead(HTTP.INTERNAL_ERROR).end()
    }
  }

/**
 * Routes: GET /limit (also /pay/limit, the app address), GET /usage (operator),
 * POST /pay/checkout, POST /pay/webhook; every other POST is a model call.
 * Browsers on `origins` may call everything but the webhook.
 * @param {object} handlers
 * @param {Function} handlers.agent
 * @param {Function} handlers.limit
 * @param {Function} handlers.pay
 * @param {Function} handlers.webhook
 * @param {Function} [handlers.usage]
 * @param {string[]} [handlers.origins]
 */
export const proxy_handler =
  ({ agent, limit, pay, webhook, usage, origins = [] }) =>
  (request, response) => {
    if (answer_release(request, response)) return
    const path = new URL(request.url ?? '/', 'http://proxy').pathname.replace(
      /\/+$/,
      ''
    )
    if (path === '/health' && request.method === 'GET')
      return response
        .writeHead(HTTP.OK, { 'content-type': 'text/plain' })
        .end('ok')
    const { origin } = request.headers
    const browser = path !== '/pay/webhook'
    if (browser && origin && origins.includes(origin)) {
      response.setHeader('access-control-allow-origin', origin)
      response.setHeader('vary', 'origin')
      if (request.method === 'OPTIONS') {
        response.writeHead(HTTP.NO_CONTENT, {
          'access-control-allow-methods': 'GET, POST',
          'access-control-allow-headers': [
            'authorization',
            'content-type',
            'x-stainless-lang',
            'x-stainless-package-version',
            'x-stainless-os',
            'x-stainless-arch',
            'x-stainless-runtime',
            'x-stainless-runtime-version',
            'x-stainless-retry-count',
            'x-stainless-timeout'
          ].join(', '),
          'access-control-max-age': '600'
        })
        return response.end()
      }
    }
    if (path === '/limit' || path === '/pay/limit')
      return request.method === 'GET' && limit
        ? limit(request, response)
        : response.writeHead(HTTP.METHOD_NOT_ALLOWED).end()
    if (path === '/usage')
      return request.method === 'GET' && usage
        ? usage(request, response)
        : response.writeHead(HTTP.NOT_FOUND).end()
    if (path === '/pay/checkout')
      return request.method === 'POST' && pay
        ? pay(request, response)
        : response.writeHead(HTTP.METHOD_NOT_ALLOWED).end()
    if (path === '/pay/webhook')
      return request.method === 'POST' && webhook
        ? webhook(request, response)
        : response.writeHead(HTTP.METHOD_NOT_ALLOWED).end()
    return agent(request, response)
  }

/** Local model endpoint. */
export const agent_service = options => create_server(agent_handler(options))
