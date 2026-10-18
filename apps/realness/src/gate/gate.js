import {
  createServer as create_server,
  request as http_request
} from 'node:http'
import { issue_halo_pass } from '#root/src/sign-on/node/halo-pass.js'
import { accept, open_pty, pump, refuse } from '#root/lib/websocket.js'
import { HTTP } from '#root/lib/http.js'

const PROTOCOL = 'realness'
const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24
const API_PORT = 8080
const RETRY_AFTER_S = 5
const PREFLIGHT = {
  'access-control-allow-methods': 'GET, POST, DELETE',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '600'
}
const DROPPED = new Set([
  'authorization',
  'cookie',
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'origin'
])

/** The token a browser offers as its second subprotocol, or null. */
export const offered_token = header => {
  const [protocol, token, extra] = (header ?? '')
    .split(',')
    .map(part => part.trim())
  return protocol === PROTOCOL && token && !extra ? token : null
}

/** Every person's sessions on one halo, until halos are chosen per person. */
export const one_halo = (address, api_port = API_PORT) => {
  const [host, port] = String(address ?? '').split(':')
  if (!host || !Number(port)) throw new Error('gate halo must be halo:port')
  return () => ({ host, port: Number(port), api_port: Number(api_port) })
}

const record = event => `${JSON.stringify(event)}\n`
const NDJSON = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
  'x-accel-buffering': 'no'
}

/**
 * Forward one browser call to the halo API under a halo pass; streams both ways.
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 * @param {{ host: string, port: number, api_port: number }} where
 * @param {string} pass
 * @param {boolean} [streaming] headers are already sent: a refusal becomes an error record
 */
const forward = (request, response, where, pass, streaming = false) =>
  /** @type {Promise<void>} */
  (
    new Promise(done => {
      const headers = Object.fromEntries(
        Object.entries(request.headers).filter(([name]) => !DROPPED.has(name))
      )
      const upstream = http_request(
        {
          host: where.host,
          port: where.api_port,
          method: request.method ?? 'GET',
          path: request.url ?? '/',
          headers: { ...headers, authorization: `Bearer ${pass}` }
        },
        reply => {
          if (streaming) {
            if (reply.statusCode === HTTP.OK) reply.pipe(response)
            else {
              const parts = []
              reply.on('data', part => parts.push(part))
              reply.on('end', () =>
                response.end(
                  record({
                    type: 'error',
                    text: `${reply.statusCode}: ${Buffer.concat(parts).toString('utf8').trim()}`
                  })
                )
              )
            }
            reply.on('end', done)
            return
          }
          response.writeHead(
            reply.statusCode ?? HTTP.BAD_GATEWAY,
            Object.fromEntries(
              Object.entries(reply.headers).filter(
                ([name]) =>
                  !DROPPED.has(name) && !name.startsWith('access-control-')
              )
            )
          )
          reply.pipe(response)
          reply.on('end', done)
        }
      )
      upstream.on('error', () => {
        if (streaming) {
          response.end(record({ type: 'error', text: 'halo unreachable' }))
          return done()
        }
        if (!response.headersSent)
          response.writeHead(HTTP.BAD_GATEWAY, {
            'content-type': 'text/plain; charset=utf-8'
          })
        response.end('halo unreachable\n')
        done()
      })
      response.on('close', () => upstream.destroy())
      request.pipe(upstream)
    })
  )

/**
 * @param {{
 *   identify: (token: string) => Promise<{ phone: string }>,
 *   halo_for: (who: { phone: string, actor?: string }) => { host: string, port: number, api_port: number } | Promise<{ host: string, port: number, api_port: number }>,
 *   secret: string,
 *   origins: string[],
 *   wake?: (options?: { watch?: (event: object) => void }) => Promise<void>,
 *   log?: (line: string) => void
 * }} options
 */
export const make_gate = ({
  identify,
  halo_for,
  secret,
  origins,
  wake = async () => {},
  log = console.info
}) => {
  const plain = (response, status, text) =>
    response
      .writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
      .end(text)
  const server = create_server(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://gate').pathname
    if (request.method === 'GET' && path === '/health')
      return plain(response, HTTP.OK, 'ok\n')
    if (!path.startsWith('/v1/'))
      return plain(response, HTTP.NOT_FOUND, 'no route\n')
    const { origin } = request.headers
    if (origin && !origins.includes(origin))
      return plain(response, HTTP.FORBIDDEN, 'origin not allowed\n')
    if (origin) response.setHeader('access-control-allow-origin', origin)
    response.setHeader('vary', 'origin')
    if (request.method === 'OPTIONS')
      return response.writeHead(HTTP.NO_CONTENT, PREFLIGHT).end()
    const token = /^Bearer (\S+)$/.exec(
      request.headers.authorization ?? ''
    )?.[1]
    if (!token) return plain(response, HTTP.UNAUTHORIZED, 'sign in first\n')
    let who
    try {
      who = await identify(token)
    } catch {
      return plain(response, HTTP.UNAUTHORIZED, 'sign in first\n')
    }
    const streaming = request.method === 'POST' && path === '/v1/startup'
    /** Startup progress shows the wake as its first stage; other calls just wait. */
    const watch = streaming
      ? event => {
          if (!response.headersSent) response.writeHead(HTTP.OK, NDJSON)
          response.write(
            record({ type: 'startup-stage', source: 'gate', ...event })
          )
        }
      : undefined
    try {
      await wake({ watch })
    } catch (error) {
      log(`gate: wake failed: ${error.message}`)
      if (response.headersSent)
        return response.end(record({ type: 'error', text: error.message }))
      response.setHeader('retry-after', String(RETRY_AFTER_S))
      return plain(response, HTTP.UNAVAILABLE, `${error.message}\n`)
    }
    const actor = /^\/v1\/actors\/([^/]+)(?:\/|$)/.exec(path)?.[1]
    try {
      await forward(
        request,
        response,
        await halo_for({ phone: who.phone, ...(actor ? { actor } : {}) }),
        issue_halo_pass(who, secret),
        response.headersSent
      )
    } catch (error) {
      log(`gate: api refused: ${error.message}`)
      if (!response.headersSent)
        plain(response, HTTP.BAD_GATEWAY, 'halo unreachable\n')
    }
  })

  server.on('upgrade', async (request, socket) => {
    socket.on('error', () => socket.destroy())
    const url = new URL(request.url ?? '/', 'http://gate')
    if (url.pathname !== '/pty')
      return refuse(socket, HTTP.NOT_FOUND, 'no route\n')
    const key = request.headers['sec-websocket-key']
    const actor = url.searchParams.get('actor')
    if (!key || !actor)
      return refuse(
        socket,
        HTTP.BAD_REQUEST,
        'needs a websocket key and an actor\n'
      )
    const origin = request.headers.origin ?? ''
    if (!origins.includes(origin))
      return refuse(socket, HTTP.FORBIDDEN, 'origin not allowed\n')
    const token = offered_token(request.headers['sec-websocket-protocol'])
    if (!token) return refuse(socket, HTTP.UNAUTHORIZED, 'sign in first\n')

    let who
    try {
      who = await identify(token)
    } catch {
      return refuse(socket, HTTP.UNAUTHORIZED, 'sign in first\n')
    }

    try {
      await wake()
    } catch (error) {
      log(`gate: wake failed: ${error.message}`)
      return refuse(socket, HTTP.UNAVAILABLE, `${error.message}\n`)
    }

    let pty
    try {
      const where = await halo_for({ phone: who.phone, actor })
      pty = await open_pty(where, {
        actor,
        pass: issue_halo_pass(who, secret),
        cols: Number(url.searchParams.get('cols') ?? DEFAULT_COLS),
        rows: Number(url.searchParams.get('rows') ?? DEFAULT_ROWS)
      })
    } catch (error) {
      log(`gate: ${actor} refused: ${error.message}`)
      return refuse(socket, HTTP.BAD_GATEWAY, `${error.message}\n`)
    }

    accept(socket, key, PROTOCOL)
    pump(socket, pty)
  })

  return server
}
