import { createServer as create_server } from 'node:http'
import { MODEL, HOUSE_MODEL, call_upstream, read_body } from './agent.js'
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
    const house = wants_house(body)
    if (house && !(ledger && plan_for)) return refuse(response, 'plan')
    if (ledger && plan_for) {
      let limit
      try {
        const plan = await plan_for(who.phone)
        if (house) {
          if (!plan.paid) limit = 'plan'
          else if (
            (await ledger.spent_since(who.phone, plan.paid.start)).cost >=
            plan.paid.credit
          )
            limit = 'credit'
        } else limit = over_limit(await ledger.spent(who.phone), plan.free)
      } catch (error) {
        warn(`usage unreadable: ${error.message}`)
        return response.writeHead(HTTP.UNAVAILABLE).end()
      }
      if (limit) return refuse(response, limit)
    }
    try {
      const model = house ? HOUSE_MODEL : MODEL
      const upstream = await call_upstream(body, { key, fetcher, model })
      response.writeHead(upstream.status, {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json'
      })
      const meter = usage_meter()
      if (!upstream.body) throw new Error('upstream answered without a body')
      for await (const chunk of upstream.body) {
        meter.add(chunk)
        response.write(chunk)
      }
      const row = {
        model,
        actor: who.id ?? 'phone',
        payer: who.phone,
        plan: house ? 'paid' : 'free',
        status: upstream.status,
        request_bytes,
        ...meter.finish()
      }
      ledger
        ?.record(who.phone, row)
        .catch(error => warn(`usage not recorded: ${error.message}`))
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
 * Routes: GET /limit (also /pay/limit, the app address), POST /pay/checkout,
 * POST /pay/webhook; every other POST is a model call. Browsers on `origins`
 * may call everything but the webhook.
 * @param {object} handlers
 * @param {Function} handlers.agent
 * @param {Function} handlers.limit
 * @param {Function} handlers.pay
 * @param {Function} handlers.webhook
 * @param {string[]} [handlers.origins]
 */
export const proxy_handler =
  ({ agent, limit, pay, webhook, origins = [] }) =>
  (request, response) => {
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
