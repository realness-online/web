import { randomUUID as random_uuid } from 'node:crypto'
import { createServer as create_server } from 'node:net'
import { NotFound } from './errors.js'
import { logger } from './log.js'
import { PTY_PORT } from './actors.js'
import { verify_host_pass } from '#root/src/sign-on/node/host-pass.js'
import { can } from '#root/src/can/can.js'
import * as vsock from './vsock.js'

const HELLO_LIMIT_BITS = 16
const DEFAULT_ROWS = 24
const HELLO_SECONDS = 30
/** A terminal with no bytes either way for this long stops holding the host. */
export const QUIET_MS = 60_000

const LOG = logger('pty')
const HELLO_LIMIT = 1 << HELLO_LIMIT_BITS

const reject = (client, message) => {
  LOG.warn(`pty refused: ${message}`)
  client.end(`${JSON.stringify({ error: message })}\n`)
}

const handle = async (
  store,
  client,
  { helloSeconds, quiet_ms },
  terminal_clients
) => {
  client.setNoDelay(true)
  const lines = new vsock.Lines(client, HELLO_LIMIT)
  let hello
  try {
    hello = await lines.read(helloSeconds)
  } catch {
    return client.destroy()
  }
  if (hello === null) return
  if (hello.length >= HELLO_LIMIT)
    return reject(client, 'hello line is too long')

  let id, cols, rows, pass
  try {
    const request = JSON.parse(hello)
    ;({ actor: id, pass } = request)
    cols = Number.parseInt(request.cols || 80, 10)
    rows = Number.parseInt(request.rows || DEFAULT_ROWS, 10)
    if (Number.isNaN(cols) || Number.isNaN(rows))
      throw new Error('cols and rows must be numbers')
  } catch (error) {
    return reject(client, `bad hello: ${error.message}`)
  }
  if (typeof id !== 'string' || !id)
    return reject(client, 'hello needs an actor id')

  let record
  try {
    const owner = verify_host_pass(pass, process.env.HOST_PASS_SECRET).phone
    record = store.get(id)
    if (
      record.owner !== owner ||
      !can({ phone: owner }, 'get', `people/${owner}/harnesses/${id}`)
    )
      throw new NotFound(id)
  } catch (error) {
    return reject(
      client,
      error instanceof NotFound ? `no such actor ${id}` : error.message
    )
  }

  if (client.destroyed) return
  let guest
  let ended = false
  let working = false
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let quiet_timer
  const connection = `connection:${random_uuid()}`
  terminal_clients.set(id, (terminal_clients.get(id) ?? 0) + 1)
  const end = () => {
    if (ended) return
    ended = true
    client.destroy()
    guest?.socket.destroy()
    const remaining = terminal_clients.get(id) - 1
    if (remaining) terminal_clients.set(id, remaining)
    else terminal_clients.delete(id)
    clearTimeout(quiet_timer)
    if (working) store.endWork(id, connection)
    if (!remaining)
      store
        .idle(id, 'disk')
        .catch(error =>
          LOG.error(`disconnect shutdown failed for ${id}`, error)
        )
  }
  client.on('close', end)
  client.on('error', end)
  try {
    await store.ensureRunning(id)
    if (ended || client.destroyed) return end()
    guest = await vsock.connect(record.vsockPath, PTY_PORT)
    if (ended || client.destroyed) {
      guest.socket.destroy()
      return end()
    }
  } catch (error) {
    reject(client, error.message)
    return end()
  }

  LOG.info(`pty attached to ${id} from ${client.remoteAddress}`)
  const active = () => {
    if (ended) return
    if (!working) store.beginWork(id, connection)
    working = true
    clearTimeout(quiet_timer)
    quiet_timer = setTimeout(() => {
      working = false
      store.endWork(id, connection)
    }, quiet_ms)
  }
  const leftover = lines.rest()
  const early = guest.lines.rest()
  active()
  client.on('data', active)
  guest.socket.on('data', active)
  guest.socket.write(`${JSON.stringify({ op: 'resize', cols, rows })}\n`)
  client.write('{"ok": true}\n')
  if (early.length) client.write(early)
  if (leftover.length) guest.socket.write(leftover)
  client.pipe(guest.socket)
  guest.socket.pipe(client)
  guest.socket.on('close', end)
  guest.socket.on('error', end)
  guest.socket.once('close', () => LOG.info(`pty detached from ${id}`))
}

export const makeServer = (
  store,
  { helloSeconds = HELLO_SECONDS, quiet_ms = QUIET_MS } = {}
) => {
  const terminal_clients = new Map()
  return create_server(client => {
    handle(store, client, { helloSeconds, quiet_ms }, terminal_clients).catch(error => {
      LOG.error(`pty failed`, error)
      client.destroy()
    })
  })
}
