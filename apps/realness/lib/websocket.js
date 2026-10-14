import { createHash as create_hash } from 'node:crypto'
import { connect } from 'node:net'
import { Lines } from '#root/lib/lines.js'

const FIN = 0x80
const MASK_BIT = 0x80
const OPCODE_BITS = 0x0f
const LENGTH_BITS = 0x7f
const LONG_LENGTH = 127
const MEDIUM_HEADER = 4
const LONG_HEADER = 10
const MASK_BYTES = 4
const NEWLINE = 10

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
export const CONTINUATION = 0x0
export const TEXT = 0x1
export const CLOSE = 0x8
export const PING = 0x9
export const PONG = 0xa
const SHORT = 126
const MEDIUM = 65536
const HELLO_SECONDS = 30
const STATUS_TEXT = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  502: 'Bad Gateway'
}

/** One unfragmented frame. */
export const frame = (opcode, payload) => {
  const { length } = payload
  let header
  if (length < SHORT) header = Buffer.from([FIN | opcode, length])
  else if (length < MEDIUM) {
    header = Buffer.alloc(MEDIUM_HEADER)
    header.writeUInt16BE(length, 2)
    header[1] = SHORT
  } else {
    header = Buffer.alloc(LONG_HEADER)
    header.writeBigUInt64BE(BigInt(length), 2)
    header[1] = 127
  }
  header[0] = FIN | opcode
  return Buffer.concat([header, payload])
}

/** Parse as many complete frames as `buffer` holds; returns the frames and the remainder. */
export const parse = input => {
  let buffer = input
  const frames = []
  for (;;) {
    if (buffer.length < 2) break
    const opcode = buffer[0] & OPCODE_BITS
    let length = buffer[1] & LENGTH_BITS
    let offset = 2
    if (length === SHORT) {
      if (buffer.length < MEDIUM_HEADER) break
      length = buffer.readUInt16BE(2)
      offset = MEDIUM_HEADER
    } else if (length === LONG_LENGTH) {
      if (buffer.length < LONG_HEADER) break
      length = Number(buffer.readBigUInt64BE(2))
      offset = LONG_HEADER
    }
    const masked = buffer[1] & MASK_BIT
    const mask = masked ? buffer.subarray(offset, offset + MASK_BYTES) : null
    if (masked) offset += MASK_BYTES
    if (buffer.length < offset + length) break
    const payload = Buffer.from(buffer.subarray(offset, offset + length))
    if (mask)
      for (let index = 0; index < payload.length; index++)
        payload[index] ^= mask[index % MASK_BYTES]
    frames.push({ opcode, payload })
    buffer = buffer.subarray(offset + length)
  }
  return { frames, rest: buffer }
}

/** An HTTP refusal on a socket that asked to upgrade. */
export const refuse = (socket, status, message) => {
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'Error'}\r\ncontent-type: text/plain; charset=utf-8\r\ncontent-length: ${Buffer.byteLength(message)}\r\nconnection: close\r\n\r\n${message}`
  )
}

/** Answer the upgrade; `protocol` echoes the subprotocol the client offered. */
export const accept = (socket, key, protocol = null) => {
  const digest = create_hash('sha1')
    .update(key + GUID)
    .digest('base64')
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${digest}\r\n${protocol ? `Sec-WebSocket-Protocol: ${protocol}\r\n` : ''}\r\n`
  )
  socket.setNoDelay(true)
}

/**
 * Open the framed terminal stream and finish its hello, so a refusal is a 502,
 * not a blank terminal.
 * @param {{ host?: string, port: number }} where
 * @param {{ actor: string, pass: string, cols: number, rows: number }} hello
 */
export const open_pty = async ({ host = '127.0.0.1', port }, hello) => {
  const stream = connect(port, host)
  await new Promise((done, fail) => {
    stream.once('connect', done)
    stream.once('error', fail)
  })
  stream.setNoDelay(true)
  const lines = new Lines(stream)
  stream.write(`${JSON.stringify(hello)}\n`)
  const answer = (await lines.read(HELLO_SECONDS))?.toString() ?? ''
  if (answer.includes('"error"') || !answer) {
    stream.destroy()
    throw new Error(answer || 'the pty stream closed')
  }
  return { stream, lines }
}

/** Pump an accepted websocket and an open pty: one text frame per line, both ways. */
export const pump = (socket, pty) => {
  const close = () => {
    if (!socket.destroyed) socket.end(frame(CLOSE, Buffer.alloc(0)))
    pty.stream.destroy()
  }

  let pending = pty.lines.rest()
  const forward = chunk => {
    pending = Buffer.concat([pending, chunk])
    let end
    while ((end = pending.indexOf(NEWLINE)) !== -1) {
      const line = pending.subarray(0, end)
      pending = pending.subarray(end + 1)
      if (line.toString().trim() && !socket.destroyed)
        socket.write(frame(TEXT, line))
    }
  }
  forward(Buffer.alloc(0))
  pty.stream.on('data', forward)
  pty.stream.on('close', close)
  pty.stream.on('error', close)

  let buffer = Buffer.alloc(0)
  socket.on('data', chunk => {
    const parsed = parse(Buffer.concat([buffer, chunk]))
    buffer = parsed.rest
    for (const { opcode, payload } of parsed.frames) {
      if (opcode === CLOSE) return close()
      if (opcode === PING) socket.write(frame(PONG, payload))
      else if (opcode === TEXT || opcode === CONTINUATION) {
        const line = payload.toString().trim()
        if (line) pty.stream.write(`${line}\n`)
      }
    }
  })
  socket.on('end', close)
  socket.on('close', close)
  socket.on('error', close)
}
