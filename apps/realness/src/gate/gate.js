import { createServer as create_server, request as http_request } from "node:http"
import { issue_host_pass } from "#root/src/sign-on/node/host-pass.js"
import { accept, open_pty, pump, refuse } from "#root/lib/websocket.js"

export const PROTOCOL = "brayness"
const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24
const API_PORT = 8080
const PREFLIGHT = { "access-control-allow-methods": "GET, POST, DELETE", "access-control-allow-headers": "authorization, content-type", "access-control-max-age": "600" }
const DROPPED = new Set(["authorization", "cookie", "host", "connection", "keep-alive", "transfer-encoding", "upgrade", "origin"])

/** The token a browser offers as its second subprotocol, or null. */
export const offered_token = (header) => {
  const [protocol, token, extra] = (header ?? "").split(",").map((part) => part.trim())
  return protocol === PROTOCOL && token && !extra ? token : null
}

/** Every person's sessions on one host, until hosts are chosen per person. */
export const one_host = (address, api_port = API_PORT) => {
  const [host, port] = String(address ?? "").split(":")
  if (!host || !Number(port)) throw new Error("gate host must be host:port")
  return () => ({ host, port: Number(port), api_port: Number(api_port) })
}

/** Forward one browser call to the host API under a host pass; streams both ways. */
const forward = (request, response, where, pass) =>
  new Promise((done) => {
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !DROPPED.has(name)))
    const upstream = http_request({ host: where.host, port: where.api_port, method: request.method, path: request.url, headers: { ...headers, authorization: `Bearer ${pass}` } }, (reply) => {
      response.writeHead(reply.statusCode, Object.fromEntries(Object.entries(reply.headers).filter(([name]) => !DROPPED.has(name) && !name.startsWith("access-control-"))))
      reply.pipe(response)
      reply.on("end", done)
    })
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain; charset=utf-8" })
      response.end("host unreachable\n")
      done()
    })
    response.on("close", () => upstream.destroy())
    request.pipe(upstream)
  })

/**
 * @param {{
 *   identify: (token: string) => Promise<{ phone: string }>,
 *   host_for: (who: { phone: string, actor: string }) => { host: string, port: number },
 *   secret: string,
 *   origins: string[],
 *   log?: (line: string) => void
 * }} options
 */
export const make_gate = ({ identify, host_for, secret, origins, log = console.log }) => {
  const plain = (response, status, text) => response.writeHead(status, { "content-type": "text/plain; charset=utf-8" }).end(text)
  const server = create_server(async (request, response) => {
    const path = new URL(request.url, "http://gate").pathname
    if (request.method === "GET" && path === "/health") return plain(response, 200, "ok\n")
    if (!path.startsWith("/v1/")) return plain(response, 404, "no route\n")
    const origin = request.headers.origin
    if (origin && !origins.includes(origin)) return plain(response, 403, "origin not allowed\n")
    if (origin) response.setHeader("access-control-allow-origin", origin)
    response.setHeader("vary", "origin")
    if (request.method === "OPTIONS") return response.writeHead(204, PREFLIGHT).end()
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "")?.[1]
    if (!token) return plain(response, 401, "sign in first\n")
    let who
    try {
      who = await identify(token)
    } catch {
      return plain(response, 401, "sign in first\n")
    }
    try {
      await forward(request, response, host_for({ phone: who.phone }), issue_host_pass(who, secret))
    } catch (error) {
      log(`gate: api refused: ${error.message}`)
      if (!response.headersSent) plain(response, 502, "host unreachable\n")
    }
  })

  server.on("upgrade", async (request, socket) => {
    socket.on("error", () => socket.destroy())
    const url = new URL(request.url, "http://gate")
    if (url.pathname !== "/pty") return refuse(socket, 404, "no route\n")
    const key = request.headers["sec-websocket-key"]
    const actor = url.searchParams.get("actor")
    if (!key || !actor) return refuse(socket, 400, "needs a websocket key and an actor\n")
    if (!origins.includes(request.headers.origin)) return refuse(socket, 403, "origin not allowed\n")
    const token = offered_token(request.headers["sec-websocket-protocol"])
    if (!token) return refuse(socket, 401, "sign in first\n")

    let who
    try {
      who = await identify(token)
    } catch {
      return refuse(socket, 401, "sign in first\n")
    }

    let pty
    try {
      const where = host_for({ phone: who.phone, actor })
      pty = await open_pty(where, {
        actor,
        pass: issue_host_pass(who, secret),
        cols: Number(url.searchParams.get("cols") ?? DEFAULT_COLS),
        rows: Number(url.searchParams.get("rows") ?? DEFAULT_ROWS)
      })
    } catch (error) {
      log(`gate: ${actor} refused: ${error.message}`)
      return refuse(socket, 502, `${error.message}\n`)
    }

    accept(socket, key, PROTOCOL)
    pump(socket, pty)
  })

  return server
}
