import { randomUUID as random_uuid } from 'node:crypto'
import { logger } from './log.js'
import { HTTP } from '#root/lib/http.js'
import { MIB } from '#root/lib/units.js'

const LOG = logger('halo')
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

/** The log travels whole; one actor's session is far under this. */
const LOG_MIB = 64
const LOG_LIMIT = LOG_MIB * MIB

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

/** The session log as JSON; TOO_LONG past its own, larger limit. */
const read_log = async request => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > LOG_LIMIT) return TOO_LONG
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }
}

/**
 * @param {{ store: import('./server.js').RouteStore, connect: (record: any) => Promise<{ socket: any, lines: any }>, limits?: ((record: any) => Promise<any>) | null }} options
 */
export const chat_handlers = ({ store, connect, limits = null }) => {
  const receiving = new Set()
  /** Hand one request to the guest's chat bridge; the actor is working until it answers. */
  const relay = async (id, response, hello) => {
    let guest
    try {
      guest = await connect(await store.ensure_running(id))
    } catch (error) {
      LOG.warn(`chat bridge failed for ${id}: ${error.message}`)
      return text(response, HTTP.BAD_GATEWAY, 'chat is unavailable\n')
    }
    const turn = `turn:${random_uuid()}`
    store.begin_work(id, turn)
    response.once('close', () => {
      guest.socket.destroy()
      store.end_work(id, turn)
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
      store.first_turn?.(id)
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
        record = await store.ensure_running(id)
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
    },

    /**
     * Take the tab's session log. The actor writes it where its harness reads on
     * the next turn, so the session continues instead of starting again.
     */
    async session_log(id, request, response) {
      const log = await read_log(request)
      if (log === TOO_LONG)
        return text(response, HTTP.PAYLOAD_TOO_LARGE, 'session log too long\n')
      if (!log || typeof log !== 'object' || !log.stores)
        return text(response, HTTP.BAD_REQUEST, 'invalid session log\n')
      let record
      try {
        record = await store.ensure_running(id)
      } catch {
        return text(response, HTTP.NOT_FOUND, 'no actor\n')
      }
      if (receiving.has(record.id))
        return text(
          response,
          HTTP.CONFLICT,
          'another session transfer is running\n'
        )
      receiving.add(record.id)
      try {
        await store.receive_log(record.id, log)
        const guest = await connect(record)
        let receipt
        try {
          guest.socket.write(`${JSON.stringify({ command: 'handover' })}\n`)
          const line = await guest.lines.read(60)
          if (!line) throw new Error('Pi did not confirm session handover')
          receipt = JSON.parse(line)
          if (
            receipt.resumed !== true ||
            receipt.handover_id !== log.handover_id
          )
            throw new Error(receipt.text || 'Pi did not load this session')
        } finally {
          guest.socket.destroy()
        }
        const body = JSON.stringify(receipt)
        response.writeHead(HTTP.OK, { 'content-type': 'application/json' })
        return response.end(body)
      } catch (error) {
        LOG.warn(`session log refused for ${id}: ${error.message}`)
        return text(response, HTTP.BAD_GATEWAY, 'the machine did not take it\n')
      } finally {
        receiving.delete(record.id)
      }
    }
  }
}
