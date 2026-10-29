#!/usr/bin/env node
/**
 * lc3: plain http on port 80 sends every request to https at the host's name,
 * so typing `haight.realness.online` works on the first visit. `/health`
 * answers ok for the local launcher's probe.
 */
import { createServer as create_server } from 'node:http'

const port = Number(process.env.PORT ?? 80)
const listen = process.env.LISTEN ?? '0.0.0.0'
const target = process.env.HTTPS_ORIGIN
if (!target) throw new Error('HTTPS_ORIGIN is required')
const HTTP_OK = 200
const MOVED = 301

create_server((request, response) => {
  if (request.url === '/health') {
    response.writeHead(HTTP_OK, { 'content-type': 'text/plain' })
    response.end('ok')
    return
  }
  response.writeHead(MOVED, {
    location: new URL(request.url ?? '/', target).href
  })
  response.end()
}).listen(port, listen, () =>
  process.stdout.write(`# http redirect on ${listen}:${port} -> ${target}\n`)
)
