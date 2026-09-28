import { createServer } from "node:http"
import { createHash } from "node:crypto"
import { call_upstream, read_body } from "./agent.js"
import { verify_model_pass } from "./model-pass.js"

const phone_hash = (phone) => createHash("sha256").update(phone).digest("hex").slice(0, 12)

/** One HTTP handler for both local Node and a deployed function. */
export function agent_handler({ identify_phone, secret, key, fetcher = fetch, log = () => {} }) {
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
    let body
    try {
      body = request.body && !Buffer.isBuffer(request.body) ? request.body : await read_body(request)
    } catch {
      return response.writeHead(400).end()
    }
    try {
      const upstream = await call_upstream(body, { key, fetcher })
      response.writeHead(upstream.status, { "content-type": upstream.headers.get("content-type") ?? "application/json" })
      for await (const chunk of upstream.body) response.write(chunk)
      response.end()
      log({ person: phone_hash(who.phone), source: who.id ?? "phone", status: upstream.status })
    } catch (error) {
      if (!response.headersSent) response.writeHead(502).end()
      else response.destroy(error)
    }
  }
}

/** Local model endpoint. */
export const agent_service = (options) => createServer(agent_handler(options))
