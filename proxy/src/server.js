import { createServer as create_server } from "node:http"
import { MODEL, HOUSE_MODEL, call_upstream, read_body } from "./agent.js"
import { verify_model_pass } from "./model-pass.js"
import { over_limit, usage_meter } from "./usage.js"
import { PAY_URL, apply_event, checkout, limit_status, verify_stripe } from "./billing.js"

// "quota exceeded" tells Pi not to retry, so the person hears at once.
export const quota_messages = (pay_url = PAY_URL) => ({
  day: `Today's free model use is spent: quota exceeded. It resets at midnight UTC. Subscribe for more at ${pay_url}`,
  month: `This month's free model use is spent: quota exceeded. It resets on the 1st, UTC. Subscribe for more at ${pay_url}`,
  plan: `The house model needs a paid plan: quota exceeded. Subscribe at ${pay_url}`,
  credit: `This period's model credit is spent: quota exceeded. It tops up when your plan renews; manage it at ${pay_url}`,
})
export const QUOTA_MESSAGES = quota_messages()

/** The house model is asked for by name; anything else is the free model. */
export const wants_house = (body) => /^(house|deepseek)/.test(String(body?.model ?? "").replace(/^brayness\//, ""))

/** Bearer: a model pass (actor or app) or a phone ID token. */
export const bearer_identity = ({ identify_phone, secret }) => {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("model pass secret must be at least 32 bytes")
  const identify = async (token) => {
    if (typeof token !== "string") throw new Error("missing bearer")
    if (token.split(".").length === 2) return verify_model_pass(token, secret)
    if (token.split(".").length !== 3) throw new Error("invalid bearer")
    return identify_phone(token)
  }
  return async (request) => {
    try {
      const who = await identify(request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1])
      return who?.phone ? who : null
    } catch {
      return null
    }
  }
}

const json = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json" })
  response.end(JSON.stringify(body))
}

/**
 * One HTTP handler for both local Node and a deployed function.
 * `plan_for(phone)` returns `{ free: { day, month }, paid }` for the payer.
 */
export const agent_handler = ({ identify_phone, secret, key, fetcher = fetch, ledger, plan_for, pay_url = PAY_URL, warn = console.error }) => {
  if (!key) throw new Error("upstream key required")
  const who_is = bearer_identity({ identify_phone, secret })
  const messages = quota_messages(pay_url)
  const refuse = (response, limit) => json(response, 429, { error: { code: 429, type: "insufficient_quota", limit, message: messages[limit] } })
  return async (request, response) => {
    if (request.method !== "POST") return response.writeHead(405).end()
    const who = await who_is(request)
    if (!who) return response.writeHead(401).end()
    let body, request_bytes
    try {
      if (request.body && !Buffer.isBuffer(request.body)) {
        body = request.body
        request_bytes = Buffer.byteLength(JSON.stringify(body))
      } else ({ body, size: request_bytes } = await read_body(request))
    } catch {
      return response.writeHead(400).end()
    }
    const house = wants_house(body)
    if (house && !(ledger && plan_for)) return refuse(response, "plan")
    if (ledger && plan_for) {
      let limit
      try {
        const plan = await plan_for(who.phone)
        if (house) {
          if (!plan.paid) limit = "plan"
          else if ((await ledger.spent_since(who.phone, plan.paid.start)).cost >= plan.paid.credit) limit = "credit"
        } else limit = over_limit(await ledger.spent(who.phone), plan.free)
      } catch (error) {
        warn(`usage unreadable: ${error.message}`)
        return response.writeHead(503).end() // an unknown total spends nothing
      }
      if (limit) return refuse(response, limit)
    }
    try {
      const model = house ? HOUSE_MODEL : MODEL
      const upstream = await call_upstream(body, { key, fetcher, model })
      response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" })
      const meter = usage_meter()
      for await (const chunk of upstream.body) {
        meter.add(chunk)
        response.write(chunk)
      }
      // Count the call before the reply ends: a /limit asked right after must see it.
      const row = { model, actor: who.id ?? "phone", payer: who.phone, plan: house ? "paid" : "free", status: upstream.status, request_bytes, ...meter.finish() }
      ledger?.record(who.phone, row).catch((error) => warn(`usage not recorded: ${error.message}`))
      response.end()
    } catch (error) {
      if (!response.headersSent) response.writeHead(502).end()
      else response.destroy(error)
    }
  }
}

/** GET /limit: the caller's limits, use, and any warning. */
export const limit_handler = ({ identify_phone, secret, ledger, plan_for, pay_url = PAY_URL }) => {
  const who_is = bearer_identity({ identify_phone, secret })
  return async (request, response) => {
    const who = await who_is(request)
    if (!who) return response.writeHead(401).end()
    try {
      const plan = await plan_for(who.phone)
      const [spent, period] = await Promise.all([ledger.spent(who.phone), plan.paid ? ledger.spent_since(who.phone, plan.paid.start) : { tokens: 0, cost: 0 }])
      json(response, 200, limit_status(plan, { ...spent, period }, { pay_url }))
    } catch {
      response.writeHead(503).end()
    }
  }
}

/** POST /pay/checkout: a signed-in person starts a subscription. */
export const checkout_handler = ({ identify_phone, secret, stripe, price, pay_url = PAY_URL }) => {
  const who_is = bearer_identity({ identify_phone, secret })
  return async (request, response) => {
    if (!stripe || !price) return json(response, 503, { error: "payments are not set up" })
    const who = await who_is(request)
    if (!who) return response.writeHead(401).end()
    try {
      json(response, 200, await checkout(stripe, { phone: who.phone, price: typeof price === "function" ? await price() : price, pay_url }))
    } catch (error) {
      json(response, 502, { error: error.message })
    }
  }
}

/** POST /pay/webhook: Stripe tells us an invoice is paid. */
export const webhook_handler = ({ stripe, billing, webhook_secret, warn = console.error, log = console.log }) => {
  return async (request, response) => {
    if (!stripe || !webhook_secret) return response.writeHead(503).end()
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    let event
    try {
      event = verify_stripe(Buffer.concat(chunks).toString("utf8"), request.headers["stripe-signature"], webhook_secret)
    } catch {
      return response.writeHead(400).end()
    }
    try {
      const changed = await apply_event(event, { stripe, billing })
      if (changed) log(`billing: ${event.type} ${changed.status ?? ""}`.trim())
      json(response, 200, { received: true })
    } catch (error) {
      warn(`billing event ${event.type} failed: ${error.message}`)
      response.writeHead(500).end() // Stripe retries
    }
  }
}

/**
 * Routes: GET /limit, POST /pay/checkout, POST /pay/webhook; every other POST
 * is a model call. Browsers on `origins` may call /limit and /pay/checkout.
 */
export const proxy_handler = ({ agent, limit, pay, webhook, origins = [] }) => {
  return async (request, response) => {
    const path = new URL(request.url ?? "/", "http://proxy").pathname.replace(/\/+$/, "")
    const origin = request.headers.origin
    const browser = path === "/limit" || path === "/pay/checkout"
    if (browser && origin && origins.includes(origin)) {
      response.setHeader("access-control-allow-origin", origin)
      response.setHeader("vary", "origin")
      if (request.method === "OPTIONS") {
        response.writeHead(204, { "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "600" })
        return response.end()
      }
    }
    if (path === "/limit") return request.method === "GET" && limit ? limit(request, response) : response.writeHead(405).end()
    if (path === "/pay/checkout") return request.method === "POST" && pay ? pay(request, response) : response.writeHead(405).end()
    if (path === "/pay/webhook") return request.method === "POST" && webhook ? webhook(request, response) : response.writeHead(405).end()
    return agent(request, response)
  }
}

/** Local model endpoint. */
export const agent_service = (options) => create_server(agent_handler(options))
