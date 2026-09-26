// The session terminal: a framed TCP stream into a guest pty.
//
// The client's first line is a hello, {"session", "cols", "rows"}; the server
// answers {"ok": true} and then copies bytes both ways. The frames are the
// guest's (brayness-pty, vsock port 53):
//
//   client -> server   {"op": "data", "data_b64"}  {"op": "resize", "cols", "rows"}
//   server -> client   {"op": "data", "data_b64"}  {"op": "exit", "code"}
//
// The vsock path keeps sessions apart; frames carry no session id. The guest
// holds the shell and Pi, so a reconnect reattaches to them.

import { createServer } from "node:net"
import { NotFound } from "./errors.js"
import { logger } from "./log.js"
import { PTY_PORT } from "./sessions.js"
import * as vsock from "./vsock.js"

const LOG = logger("pty")
const HELLO_LIMIT = 1 << 16

function reject(client, message) {
  LOG.warn(`pty refused: ${message}`)
  client.end(`${JSON.stringify({ error: message })}\n`)
}

async function handle(store, client, helloSeconds) {
  client.setNoDelay(true)
  const lines = new vsock.Lines(client, HELLO_LIMIT)
  let hello
  try {
    hello = await lines.read(helloSeconds)
  } catch {
    return client.destroy() // no hello in time: nothing to answer
  }
  if (hello === null) return
  if (hello.length >= HELLO_LIMIT) return reject(client, "hello line is too long")

  let id, cols, rows
  try {
    const request = JSON.parse(hello)
    id = request.session
    cols = Number.parseInt(request.cols || 80, 10)
    rows = Number.parseInt(request.rows || 24, 10)
    if (Number.isNaN(cols) || Number.isNaN(rows)) throw new Error("cols and rows must be numbers")
  } catch (error) {
    return reject(client, `bad hello: ${error.message}`)
  }
  if (typeof id !== "string" || !id) return reject(client, "hello needs a session id")

  let guest
  try {
    const record = await store.ensureRunning(id)
    guest = await vsock.connect(record.vsockPath, PTY_PORT)
  } catch (error) {
    return reject(client, error instanceof NotFound ? `no such session ${id}` : error.message)
  }

  LOG.info(`pty attached to ${id} from ${client.remoteAddress}`)
  const leftover = lines.rest()
  const early = guest.lines.rest()
  guest.socket.write(`${JSON.stringify({ op: "resize", cols, rows })}\n`)
  client.write('{"ok": true}\n')
  if (early.length) client.write(early)
  if (leftover.length) guest.socket.write(leftover)
  client.pipe(guest.socket)
  guest.socket.pipe(client)
  const end = () => {
    client.destroy()
    guest.socket.destroy()
  }
  client.on("close", end)
  client.on("error", end)
  guest.socket.on("close", end)
  guest.socket.on("error", end)
  guest.socket.once("close", () => LOG.info(`pty detached from ${id}`))
}

export function makeServer(store, { helloSeconds = 30 } = {}) {
  return createServer((client) => {
    handle(store, client, helloSeconds).catch((error) => {
      LOG.error(`pty failed`, error)
      client.destroy()
    })
  })
}
