// The browser terminal: a websocket in front of the framed pty stream.
//
//   GET /      the page, and a session for it when the URL names none
//   GET /pty   websocket; the query is the hello (?session=, cols, rows)
//
// A bare GET / is the door: the API that creates sessions is on loopback, so
// this server makes one and redirects with its id on the URL. The websocket is
// RFC 6455 by hand, text frames only: the host takes no dependencies.

import { createHash } from "node:crypto"
import { readFileSync, realpathSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { connect } from "node:net"
import { extname, join, sep } from "node:path"
import { logger } from "./log.js"
import { CONTENT_TYPES } from "./server.js"
import { Lines } from "./vsock.js"

const LOG = logger("webterm")
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
const [CONTINUATION, TEXT, CLOSE, PING, PONG] = [0x0, 0x1, 0x8, 0x9, 0xa]

function frame(opcode, payload) {
  const length = payload.length
  let header
  if (length < 126) header = Buffer.from([0x80 | opcode, length])
  else if (length < 65536) {
    header = Buffer.alloc(4)
    header.writeUInt16BE(length, 2)
    header[1] = 126
  } else {
    header = Buffer.alloc(10)
    header.writeBigUInt64BE(BigInt(length), 2)
    header[1] = 127
  }
  header[0] = 0x80 | opcode
  return Buffer.concat([header, payload])
}

/** Parse as many complete frames as `buffer` holds; returns the frames and the remainder. */
function parse(buffer) {
  const frames = []
  for (;;) {
    if (buffer.length < 2) break
    const opcode = buffer[0] & 0x0f
    let length = buffer[1] & 0x7f
    let offset = 2
    if (length === 126) {
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

function text(response, status, body) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8", "content-length": Buffer.byteLength(body), connection: "close" })
  response.end(body)
}

export function makeServer({ pageRoot, streamPort, newSession }) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://host")
    if (["/", "/term", "/index.html"].includes(url.pathname)) {
      if (!url.searchParams.get("session") && newSession) {
        let record
        try {
          record = await newSession()
        } catch (error) {
          LOG.error("could not create a session for a bare page", error)
          return text(response, 502, `could not start a session: ${error.message}\n`)
        }
        LOG.info(`bare page: created ${record.id}`)
        // A new Pi conversation in the new session; old ones stay searchable.
        response.writeHead(302, { location: `/?session=${record.id}&exec=brayness`, "content-length": 0, connection: "close" })
        return response.end()
      }
      try {
        const page = readFileSync(join(pageRoot, "index.html"))
        response.writeHead(200, { "content-type": CONTENT_TYPES[".html"], "content-length": page.length, connection: "close" })
        return response.end(page)
      } catch {
        return text(response, 503, "no terminal page: term/ was not shipped\n")
      }
    }
    if (url.pathname === "/pty") return text(response, 400, request.headers["sec-websocket-key"] ? "no session\n" : "no websocket key\n")
    // The built page's hashed assets and the wasm.
    try {
      const root = realpathSync(pageRoot)
      const target = realpathSync(join(root, decodeURIComponent(url.pathname)))
      if (!target.startsWith(root + sep) || !statSync(target).isFile()) throw new Error()
      const body = readFileSync(target)
      response.writeHead(200, { "content-type": CONTENT_TYPES[extname(target)] ?? "application/octet-stream", "content-length": body.length, connection: "close" })
      response.end(body)
    } catch {
      text(response, 404, "no route\n")
    }
  })

  server.on("upgrade", (request, socket) => bridge(request, socket, streamPort))
  return server
}

function refuse(socket, status, message) {
  socket.end(`HTTP/1.1 ${status} ${status === 400 ? "Bad Request" : "Bad Gateway"}\r\ncontent-type: text/plain; charset=utf-8\r\ncontent-length: ${Buffer.byteLength(message)}\r\nconnection: close\r\n\r\n${message}`)
}

/** Open the framed stream and finish its hello, so a refusal is a 502, not a blank terminal. */
async function openPty(streamPort, hello) {
  const stream = connect(streamPort, "127.0.0.1")
  await new Promise((done, fail) => {
    stream.once("connect", done)
    stream.once("error", fail)
  })
  stream.setNoDelay(true)
  const lines = new Lines(stream)
  stream.write(`${JSON.stringify(hello)}\n`)
  const answer = (await lines.read(30))?.toString() ?? ""
  if (answer.includes('"error"') || !answer) {
    stream.destroy()
    throw new Error(answer || "the pty stream closed")
  }
  return { stream, lines }
}

async function bridge(request, socket, streamPort) {
  const url = new URL(request.url, "http://host")
  if (url.pathname !== "/pty") return refuse(socket, 400, "no route\n")
  const session = url.searchParams.get("session")
  if (!session) return refuse(socket, 400, "no session\n")
  const key = request.headers["sec-websocket-key"]
  if (!key) return refuse(socket, 400, "no websocket key\n")

  let pty
  try {
    pty = await openPty(streamPort, { session, cols: Number(url.searchParams.get("cols") ?? 80), rows: Number(url.searchParams.get("rows") ?? 24) })
  } catch (error) {
    LOG.warn(`pty bridge failed for ${session}: ${error.message}`)
    return refuse(socket, 502, `${error.message}\n`)
  }

  const accept = createHash("sha1").update(key + GUID).digest("base64")
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
  socket.setNoDelay(true)

  const close = () => {
    if (!socket.destroyed) socket.end(frame(CLOSE, Buffer.alloc(0)))
    pty.stream.destroy()
  }

  // pty -> websocket: one text frame per line.
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

  // websocket -> pty: each text frame is one line.
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
  socket.on("close", close)
  socket.on("error", close)
}
