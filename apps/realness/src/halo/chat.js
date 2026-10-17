import { randomUUID as random_uuid } from 'node:crypto'
import { logger } from './log.js'
import { HTTP } from '#root/lib/http.js'

const LOG = logger('host')
const MESSAGE_LIMIT = 16_384
/** The chat bridge's commands; anything else never reaches the guest. */
const COMMANDS = new Set(['stop', 'new', 'compact', 'model', 'thinking'])
const NDJSON = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store'
}

const text = (response, status, body) => {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store'
  })
  response.end(body)
}

/** Pipe a guest chat stream to the response; `hello` starts it. */
const stream = (response, guest, hello) => {
  response.writeHead(HTTP.OK, NDJSON)
  const early = guest.lines.rest()
  if (early.length) response.write(early)
  guest.socket.on('error', () => response.destroy())
  guest.socket.pipe(response)
  guest.socket.write(`${JSON.stringify(hello)}\n`)
}

/**
 * @param {{ store: any, connect: (record: any) => Promise<{ socket: any, lines: any }>, limits?: ((record: any) => Promise<any>) | null }} options
 */
const TOO_LONG = Symbol('too long')

/** The request body as JSON; TOO_LONG past the limit, null when it is not JSON. */
const read_json = async request => {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > MESSAGE_LIMIT) return TOO_LONG
  }
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

/**
 * @param {{ store: import('./server.js').RouteStore, connect: (record: any) => Promise<{ socket: any, lines: any }>, limits?: ((record: any) => Promise<any>) | null }} options
 */
export const chat_handlers = ({ store, connect, limits = null }) => {
  /** Hand one request to the guest's chat bridge; the actor is working until it answers. */
  const relay = async (id, response, hello) => {
    let guest
    try {
      guest = await connect(await store.ensureRunning(id))
    } catch (error) {
      LOG.warn(`chat bridge failed for ${id}: ${error.message}`)
      return text(response, HTTP.BAD_GATEWAY, 'chat is unavailable\n')
    }
    const turn = `turn:${random_uuid()}`
    store.beginWork(id, turn)
    response.once('close', () => {
      guest.socket.destroy()
      store.endWork(id, turn)
    })
    stream(response, guest, hello)
  }

  return {
    async message(id, request, response) {
      const body = await read_json(request)
      if (body === TOO_LONG)
        return text(response, HTTP.PAYLOAD_TOO_LARGE, 'message too long\n')
      const message = body?.message
      if (typeof message !== 'string' || !message.trim())
        return text(response, HTTP.BAD_REQUEST, 'invalid message\n')
      store.firstTurn?.(id)
      return relay(id, response, { message })
    },

    async command(id, request, response) {
      const body = await read_json(request)
      if (body === TOO_LONG)
        return text(response, HTTP.PAYLOAD_TOO_LARGE, 'command too long\n')
      const args = body?.args ?? ''
      if (!COMMANDS.has(body?.command) || typeof args !== 'string')
        return text(response, HTTP.BAD_REQUEST, 'invalid command\n')
      return relay(id, response, { command: body.command, args })
    },

    async events(id, response) {
      let record
      try {
        record = await store.ensureRunning(id)
      } catch {
        return text(response, HTTP.NOT_FOUND, 'no actor\n')
      }
      let guest
      try {
        guest = await connect(record)
      } catch (error) {
        LOG.warn(`chat watch failed for ${id}: ${error.message}`)
        return text(response, HTTP.BAD_GATEWAY, 'chat is unavailable\n')
      }
      response.once('close', () => guest.socket.destroy())
      stream(response, guest, { watch: true })
    },

    async limit(id, response) {
      let status = null
      try {
        status = limits ? await limits(store.get(id)) : null
      } catch (error) {
        LOG.warn(`limit check failed for ${id}: ${error.message}`)
      }
      const body = Buffer.from(JSON.stringify(status ?? { warn: null }))
      response.writeHead(HTTP.OK, {
        'content-type': 'application/json',
        'content-length': body.length,
        'cache-control': 'no-store'
      })
      response.end(body)
    }
  }
}
