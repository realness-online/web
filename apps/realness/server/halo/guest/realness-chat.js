#!/usr/bin/env node
/**
 * One chat prompt over guest vsock port 55, relayed to the terminal's Pi.
 *
 * The actor runs one Pi, in its terminal. Its chat-bridge extension listens on
 * a unix socket; this relays the browser's message there and its JSON-line
 * reply back. Chat and terminal share one session. Nothing starts a Pi per
 * message.
 *
 * `{"watch": true}` holds the connection open as a live view of that session,
 * until either end closes it. `{"command", "args"}` runs one chat command and
 * relays its single reply.
 */
import { connect } from 'node:net'

const SOCKET = process.argv[2] ?? '/run/realness/pi-chat.sock'
const LINE_LIMIT = 16384
const TIMEOUT_MS = 600_000

const say = value => process.stdout.write(`${JSON.stringify(value)}\n`)
const quiet = () => connect(SOCKET)

/** A live view of the terminal's session until either end closes. */
const watch = () => {
  const pi = quiet()
  pi.on('error', () =>
    say({ type: 'error', text: 'Pi is not running in the terminal' })
  )
  pi.on('connect', () => {
    pi.write('{"watch": true}\n')
    pi.pipe(process.stdout)
    process.stdin.pipe(pi)
    process.stdin.on('end', () => pi.end())
  })
  pi.on('close', () => process.stdin.destroy())
}

/** Send one request and pass the reply lines straight through. */
const relay = request => {
  const pi = quiet()
  pi.setTimeout(TIMEOUT_MS, () => {
    pi.destroy()
    say({ type: 'error', text: 'Pi timed out' })
  })
  pi.on('error', () =>
    say({ type: 'error', text: 'Pi is not running in the terminal' })
  )
  pi.on('connect', () => pi.write(`${JSON.stringify(request)}\n`))
  pi.pipe(process.stdout)
  pi.on('close', () => process.stdin.destroy())
}

/** The browser's whole message: one JSON line, then it may close. */
const text = await new Promise(done => {
  let buffered = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => (buffered += chunk))
  process.stdin.on('end', () => done(buffered))
})
const [line] = text.split('\n')
/** @type {Record<string, any> | null} */
let request = null
try {
  request = JSON.parse(line)
} catch {}

const invalid = value => {
  say({ type: 'error', text: value })
  process.stdin.destroy()
}
if (typeof request !== 'object' || request === null || text.length > LINE_LIMIT)
  invalid('invalid message')
else if (request.watch === true) watch()
else if ('command' in request) {
  const { command, args = '' } = request
  if (typeof command !== 'string' || !command || typeof args !== 'string')
    invalid('invalid command')
  else relay({ command, args })
} else if (typeof request.message !== 'string' || !request.message.trim())
  invalid('invalid message')
else relay({ message: request.message })
