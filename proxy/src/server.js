import { createServer } from "node:http"
import { MODEL, call_upstream, read_body } from "./agent.js"
import { verify_model_pass } from "./model-pass.js"
import { over_quota, usage_meter } from "./usage.js"

export const QUOTA_MESSAGE = "Free daily model use is spent: quota exceeded. It resets at midnight UTC."

/** One HTTP handler for both local Node and a deployed function. */
export function agent_handler({ identify_phone, secret, key, fetcher = fetch, ledger, quota, warn = console.error }) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error("model pass secret must be at least 32 bytes")
  if (!key) throw new Error("upstream key required")
  const identify = async (token) => {
    if (typeof token !== "string") throw new Error("missing bearer")
    if (token.split(".").length === 2) return verify_model_pass(token, secret)
    if (token.split(".").length !== 3) throw new Error("invalid bearer")
    return identify_phone(token)
  }
  return async (request, response) => {
    if (request.method !== "POST") return response.writeHead(405).end()
    let who
    try {
      who = await identify(request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1])
    } catch {
      return response.writeHead(401).end()
    }
    if (!who?.phone) return response.writeHead(401).end()
    if (ledger && quota) {
      let spent
      try {
        spent = await ledger.spent(who.phone)
      } catch (error) {
        warn(`usage unreadable: ${error.message}`)
        return response.writeHead(503).end() // an unknown total spends nothing
      }
      if (over_quota(spent, quota)) {
        // "quota exceeded" tells Pi not to retry, so the person hears at once.
        response.writeHead(429, { "content-type": "application/json" })
        return response.end(JSON.stringify({ error: { code: 429, type: "insufficient_quota", message: QUOTA_MESSAGE } }))
      }
    }
    let body, request_bytes
    try {
      if (request.body && !Buffer.isBuffer(request.body)) {
        body = request.body
        request_bytes = Buffer.byteLength(JSON.stringify(body))
      } else ({ body, size: request_bytes } = await read_body(request))
    } catch {
      return response.writeHead(400).end()
    }
    try {
      const upstream = await call_upstream(body, { key, fetcher })
      response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" })
      const meter = usage_meter()
      for await (const chunk of upstream.body) {
        meter.add(chunk)
        response.write(chunk)
      }
      response.end()
      const row = { model: MODEL, actor: who.id ?? "phone", status: upstream.status, request_bytes, ...meter.finish() }
      ledger?.record(who.phone, row).catch((error) => warn(`usage not recorded: ${error.message}`))
    } catch (error) {
      if (!response.headersSent) response.writeHead(502).end()
      else response.destroy(error)
    }
  }
}

/** Local model endpoint. */
export const agent_service = (options) => createServer(agent_handler(options))
