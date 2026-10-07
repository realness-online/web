// Chat with an actor's one Pi session. Callers check ownership first: the
// host page by its cookie (until r3), the host API by a host pass.
//
//   message  POST {"message"} -> the turn as NDJSON, until Pi answers
//   events   GET  history, then every turn, as NDJSON; watching is not work
//   limit    GET  the owner's model limits, from the proxy
import { logger } from "./log.js"

const LOG = logger("host")
const MESSAGE_LIMIT = 16_384
const NDJSON = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" }

const text = (response, status, body) => {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" })
  response.end(body)
}

/** Pipe a guest chat stream to the response; `hello` starts it. */
const stream = (response, guest, hello) => {
  response.writeHead(200, NDJSON)
  const early = guest.lines.rest()
  if (early.length) response.write(early)
  guest.socket.on("error", () => response.destroy())
  guest.socket.pipe(response)
  guest.socket.write(`${JSON.stringify(hello)}\n`)
}

/**
 * @param {{ store: any, connect: (record: any) => Promise<{ socket: any, lines: any }>, limits?: ((record: any) => Promise<any>) | null }} options
 */
export const chat_handlers = ({ store, connect, limits = null }) => ({
  async message(id, request, response) {
    let body = ""
    for await (const chunk of request) {
      body += chunk
      if (Buffer.byteLength(body) > MESSAGE_LIMIT) return text(response, 413, "message too long\n")
    }
    let message
    try {
      message = JSON.parse(body).message
    } catch {
      return text(response, 400, "invalid message\n")
    }
    if (typeof message !== "string" || !message.trim()) return text(response, 400, "invalid message\n")
    // m3: the first message this host accepts is the first turn; time it from create.
    store.firstTurn?.(id)
    let guest
    try {
      guest = await connect(await store.ensureRunning(id))
    } catch (error) {
      LOG.warn(`chat bridge failed for ${id}: ${error.message}`)
      return text(response, 502, "chat is unavailable\n")
    }
    store.beginWork(id)
    response.once("close", () => {
      guest.socket.destroy()
      store.endWork(id)
    })
    stream(response, guest, { message })
  },

  async events(id, response) {
    let record
    try {
      record = await store.ensureRunning(id)
    } catch {
      return text(response, 404, "no actor\n")
    }
    let guest
    try {
      guest = await connect(record)
    } catch (error) {
      LOG.warn(`chat watch failed for ${id}: ${error.message}`)
      return text(response, 502, "chat is unavailable\n")
    }
    response.once("close", () => guest.socket.destroy())
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
    response.writeHead(200, { "content-type": "application/json", "content-length": body.length, "cache-control": "no-store" })
    response.end(body)
  },
})
