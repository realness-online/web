#!/usr/bin/env node
/**
 * The box's door for the three guest agents. Each agent listens on its own
 * socket (exec on 52, pty on 53, chat on 55); this fronts them with the
 * Firecracker CONNECT/OK handshake, so the halo's vsock channel needs no
 * changes and any socket reaches any port.
 *
 *   node realness-responder.js [box dir]
 *
 * Node, not Python: the image carries no interpreter it does not need.
 */
import { connect, createServer as create_server } from 'node:net'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { existsSync as exists_sync, unlinkSync as unlink_sync } from 'node:fs'
import { join } from 'node:path'

const BOX = '/box'
const NEWLINE = '\n'.charCodeAt(0)
/** Port names a guest agent answers on, and the socket it listens to. */
export const AGENTS = new Map([
  ['52', 'agent.sock'],
  ['53', 'pty.sock'],
  ['55', 'chat.sock']
])

/**
 * The port a CONNECT line names, or the listener's own when it names none.
 * @param {string} line
 * @param {string} fallback
 * @returns {string}
 */
export const port_of = (line, fallback) => {
  const [, named] = line.trim().split(/\s+/)
  return AGENTS.has(named) ? named : fallback
}

/**
 * Bridge one accepted connection to its agent: greet with OK, then copy both
 * ways until either side closes.
 * @param {import('node:net').Socket} client
 * @param {string} port
 * @param {string} box
 */
const bridge = (client, port, box) => {
  let greeted = false
  /** @type {import('node:net').Socket | null} */
  let upstream = null
  const open = requested => {
    const socket = connect(
      join(box, AGENTS.get(requested) ?? AGENTS.get(port) ?? '')
    )
    upstream = socket
    socket.on('error', () => client.destroy())
    socket.on('connect', () => {
      client.write(`OK ${requested}\n`)
      client.pipe(socket)
      socket.pipe(client)
    })
    socket.on('close', () => client.destroy())
  }
  client.on('error', () => upstream?.destroy())
  client.on('data', (/** @type {Buffer} */ chunk) => {
    if (greeted) return
    const end = chunk.indexOf(NEWLINE)
    if (end === -1) return
    greeted = true
    const line = chunk.subarray(0, end).toString()
    const rest = chunk.subarray(end + 1)
    const requested = port_of(line, port)
    client.pause()
    open(requested)
    if (rest.length) client.unshift(rest)
  })
  client.on('close', () => upstream?.destroy())
}

/**
 * Listen on `sock-<port>` for each agent, beside the box's sockets.
 * @param {{ box?: string, on_ready?: (path: string) => void }} [options]
 * @returns {Promise<import('node:net').Server[]>}
 */
export const serve = async ({ box = BOX, on_ready = () => {} } = {}) => {
  const servers = []
  for (const port of AGENTS.keys()) {
    const path = join(box, `sock-${port}`)
    if (exists_sync(path)) unlink_sync(path)
    const server = create_server(client => bridge(client, port, box))
    server.on('error', () => {})
    // eslint-disable-next-line no-await-in-loop -- one socket is bound at a time, in port order
    await new Promise(done => {
      server.listen(path, () => done(null))
    })
    on_ready(path)
    servers.push(server)
  }
  return servers
}

if (process.argv[1] && file_url_to_path(import.meta.url) === process.argv[1])
  await serve({ box: process.argv[2] ?? BOX })
