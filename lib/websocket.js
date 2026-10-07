// RFC 6455 by hand, text frames only, plus the bridge between a browser
// websocket and the host's framed terminal stream. The host and the gate both
// use it, and neither takes a dependency.
import { createHash as create_hash } from "node:crypto"
import { connect } from "node:net"
import { Lines } from "#root/lib/lines.js"

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
export const [CONTINUATION, TEXT, CLOSE, PING, PONG] = [0x0, 0x1, 0x8, 0x9, 0xa]
const SHORT = 126
const MEDIUM = 65536
const HELLO_SECONDS = 30
const STATUS_TEXT = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 502: "Bad Gateway" }

/** One unfragmented frame. */
export const frame = (opcode, payload) => {
  const length = payload.length
  let header
  if (length < SHORT) header = Buffer.from([0x80 | opcode, length])
  else if (length < MEDIUM) {
    header = Buffer.alloc(4)
    header.writeUInt16BE(length, 2)
    header[1] = SHORT
  } else {
    header = Buffer.alloc(10)
    header.writeBigUInt64BE(BigInt(length), 2)
    header[1] = 127
  }
  header[0] = 0x80 | opcode
  return Buffer.concat([header, payload])
}

/** Parse as many complete frames as `buffer` holds; returns the frames and the remainder. */
export const parse = (buffer) => {
  const frames = []
  for (;;) {
    if (buffer.length < 2) break
    const opcode = buffer[0] & 0x0f
    let length = buffer[1] & 0x7f
    let offset = 2
    if (length === SHORT) {
      if (buffer.length < 4) break
      length = buffer.readUInt16BE(2)
      offset = 4
    } else if (length === 127) {
      if (buffer.length < 10) break
      length = Number(buffer.readBigUInt64BE(2))
      offset = 10
    }
    const masked = buffer[1] & 0x80
    const mask = masked ? buffer.subarray(offset, offset + 4) : null
    if (masked) offset += 4
    if (buffer.length < offset + length) break
    const payload = Buffer.from(buffer.subarray(offset, offset + length))
    if (mask) for (let index = 0; index < payload.length; index++) payload[index] ^= mask[index % 4]
    frames.push({ opcode, payload })
    buffer = buffer.subarray(offset + length)
  }
  return { frames, rest: buffer }
}

/** An HTTP refusal on a socket that asked to upgrade. */
export const refuse = (socket, status, message) => {
  socket.end(`HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? "Error"}\r\ncontent-type: text/plain; charset=utf-8\r\ncontent-length: ${Buffer.byteLength(message)}\r\nconnection: close\r\n\r\n${message}`)
}

/** Answer the upgrade; `protocol` echoes the subprotocol the client offered. */
export const accept = (socket, key, protocol = null) => {
  const digest = create_hash("sha1").update(key + GUID).digest("base64")
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${digest}\r\n${protocol ? `Sec-WebSocket-Protocol: ${protocol}\r\n` : ""}\r\n`)
  socket.setNoDelay(true)
}

/**
 * Open the framed terminal stream and finish its hello, so a refusal is a 502,
 * not a blank terminal.
 * @param {{ host?: string, port: number }} where
 * @param {{ actor: string, pass: string, cols: number, rows: number }} hello
 */
export const open_pty = async ({ host = "127.0.0.1", port }, hello) => {
  const stream = connect(port, host)
  await new Promise((done, fail) => {
    stream.once("connect", done)
    stream.once("error", fail)
  })
  stream.setNoDelay(true)
  const lines = new Lines(stream)
  stream.write(`${JSON.stringify(hello)}\n`)
  const answer = (await lines.read(HELLO_SECONDS))?.toString() ?? ""
  if (answer.includes('"error"') || !answer) {
    stream.destroy()
    throw new Error(answer || "the pty stream closed")
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
  const forward = (chunk) => {
    pending = Buffer.concat([pending, chunk])
    let end
    while ((end = pending.indexOf(10)) !== -1) {
      const line = pending.subarray(0, end)
      pending = pending.subarray(end + 1)
      if (line.toString().trim() && !socket.destroyed) socket.write(frame(TEXT, line))
    }
  }
  forward(Buffer.alloc(0))
  pty.stream.on("data", forward)
  pty.stream.on("close", close)
  pty.stream.on("error", close)

  let buffer = Buffer.alloc(0)
  socket.on("data", (chunk) => {
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
  // Upgraded sockets allow half-open: a peer that vanishes without a close
  // frame only ends, and would hold the pty open.
  socket.on("end", close)
  socket.on("close", close)
  socket.on("error", close)
}
