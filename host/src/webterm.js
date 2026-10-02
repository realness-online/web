// The browser terminal: a websocket in front of the framed pty stream.
//
//   GET /      the page, and an actor for it when the URL names none
//   GET /pty   websocket; the query is the hello (?actor=, cols, rows)
//
// A bare GET / is the door: the API that creates actors is on loopback, so
// this server makes one and redirects with its id on the URL. The websocket is
// RFC 6455 by hand, text frames only: the host takes no dependencies.

import { createHash } from "node:crypto"
import { readFileSync, realpathSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { connect } from "node:net"
import { extname, join, sep } from "node:path"
import { logger } from "./log.js"
import { CONTENT_TYPES } from "./server.js"
import { terminal_auth } from "./terminal-auth.js"
import { can } from "../../can/src/can.js"
import * as vsock from "./vsock.js"

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

export function makeServer({ pageRoot, chatRoot = null, streamPort, newActor, store, auth = terminal_auth(process.env.HOST_PASS_SECRET), connectChat = (record) => vsock.connect(record.vsockPath, 55), limits = null }) {
  const same_origin = (request) => {
    const origin = request.headers.origin
    return origin === `http://${request.headers.host}` || origin === `https://${request.headers.host}`
  }
  const allowed = (phone, id) => {
    const record = store.get(id)
    return record.owner === phone && can({ phone }, "get", `people/${phone}/harnesses/${id}`)
  }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://host")
    if (request.method === "GET" && url.pathname === "/handoff") {
      const origin = process.env.SIGN_ON_ORIGIN
      if (!origin) return text(response, 503, "sign-on origin is not configured\n")
      const destination = url.searchParams.get("next") === "chat" ? "/chat" : "/"
      const page = Buffer.from(`<!doctype html><title>Opening Brayness</title><p>Waiting for sign-in...</p><script>const trusted=${JSON.stringify(origin)};const open=async pass=>{const response=await fetch('/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pass})});if(response.ok)location.replace(${JSON.stringify(destination)});else document.querySelector('p').textContent='Sign-in handoff failed'};const carried=new URLSearchParams(location.hash.slice(1)).get('pass');if(carried){history.replaceState(null,'',location.pathname+location.search);open(carried)}window.addEventListener('message',async event=>{if(event.origin!==trusted||event.source!==window.opener||event.data?.type!=='brayness-pass')return;const response=await fetch('/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pass:event.data.pass})});if(response.ok)location.replace(${JSON.stringify(destination)});else document.querySelector('p').textContent='Sign-in handoff failed'});if(window.opener)window.opener.postMessage({type:'brayness-ready'},trusted);</script>`)
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": page.length, "cache-control": "no-store", "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'" })
      return response.end(page)
    }
    if (request.method === "POST" && url.pathname === "/auth") {
      if (!same_origin(request)) return text(response, 403, "bad origin\n")
      const chunks = []
      for await (const chunk of request) {
        chunks.push(chunk)
        if (chunks.reduce((sum, part) => sum + part.length, 0) > 4096) return text(response, 413, "body too large\n")
      }
      try {
        const value = auth.cookie(JSON.parse(Buffer.concat(chunks).toString()).pass)
        response.writeHead(204, { "set-cookie": `${auth.cookie_name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${auth.cookie_age}${request.headers.host?.startsWith("localhost:") || request.headers.host?.startsWith("127.0.0.1:") ? "" : "; Secure"}`, "cache-control": "no-store" })
        return response.end()
      } catch {
        return text(response, 401, "invalid pass\n")
      }
    }
    const phone = auth.owner(request.headers.cookie)
    const chat = url.pathname === "/chat" || url.pathname.startsWith("/chat/")
    if (!phone && (url.pathname === "/ticket" || chat || ["/", "/term", "/index.html"].includes(url.pathname))) return text(response, 401, "sign in\n")
    if (chat && url.searchParams.get("actor")) {
      try {
        if (!allowed(phone, url.searchParams.get("actor"))) return text(response, 404, "no actor\n")
      } catch {
        return text(response, 404, "no actor\n")
      }
    }
    if (request.method === "POST" && url.pathname === "/chat/message") {
      if (!phone || !same_origin(request)) return text(response, 403, "not signed in\n")
      const id = url.searchParams.get("actor")
      let record
      try {
        if (!allowed(phone, id)) return text(response, 404, "no actor\n")
        record = store.get(id)
      } catch {
        return text(response, 404, "no actor\n")
      }
      let body = ""
      for await (const chunk of request) {
        body += chunk
        if (Buffer.byteLength(body) > 16_384) return text(response, 413, "message too long\n")
      }
      let message
      try {
        message = JSON.parse(body).message
      } catch {
        return text(response, 400, "invalid message\n")
      }
      if (typeof message !== "string" || !message.trim()) return text(response, 400, "invalid message\n")
      let guest
      try {
        record = await store.ensureRunning(id)
        guest = await connectChat(record)
      } catch (error) {
        LOG.warn(`chat bridge failed for ${id}: ${error.message}`)
        return text(response, 502, "chat is unavailable\n")
      }
      store.beginWork(id)
      const end = () => { guest.socket.destroy(); store.endWork(id) }
      response.once("close", end)
      response.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" })
      const early = guest.lines.rest()
      if (early.length) response.write(early)
      guest.socket.on("error", () => response.destroy())
      guest.socket.pipe(response)
      guest.socket.write(`${JSON.stringify({ message })}\n`)
      return
    }
    // The GUI's live view of the actor's one Pi session: history, then every
    // turn, whether typed in the TUI or sent from the GUI. Watching is not work,
    // so an open page does not hold the actor awake.
    if (request.method === "GET" && url.pathname === "/chat/events") {
      if (!phone) return text(response, 403, "not signed in\n")
      const id = url.searchParams.get("actor")
      let record
      try {
        if (!allowed(phone, id)) return text(response, 404, "no actor\n")
        record = await store.ensureRunning(id)
      } catch {
        return text(response, 404, "no actor\n")
      }
      let guest
      try {
        guest = await connectChat(record)
      } catch (error) {
        LOG.warn(`chat watch failed for ${id}: ${error.message}`)
        return text(response, 502, "chat is unavailable\n")
      }
      response.once("close", () => guest.socket.destroy())
      response.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" })
      const early = guest.lines.rest()
      if (early.length) response.write(early)
      guest.socket.on("error", () => response.destroy())
      guest.socket.pipe(response)
      guest.socket.write(`${JSON.stringify({ watch: true })}\n`)
      return
    }
    // b1c: the chat page asks after each reply; the proxy decides the warning.
    if (request.method === "GET" && url.pathname === "/chat/limit") {
      const id = url.searchParams.get("actor")
      let record
      try {
        if (!allowed(phone, id)) return text(response, 404, "no actor\n")
        record = store.get(id)
      } catch {
        return text(response, 404, "no actor\n")
      }
      let status = null
      try {
        status = limits ? await limits(record) : null
      } catch (error) {
        LOG.warn(`limit check failed for ${id}: ${error.message}`)
      }
      const body = Buffer.from(JSON.stringify(status ?? { warn: null }))
      response.writeHead(200, { "content-type": "application/json", "content-length": body.length, "cache-control": "no-store" })
      return response.end(body)
    }
    if (request.method === "POST" && url.pathname === "/ticket") {
      if (!same_origin(request)) return text(response, 403, "bad origin\n")
      const id = url.searchParams.get("actor")
      try {
        if (!allowed(phone, id)) return text(response, 404, "no actor\n")
      } catch {
        return text(response, 404, "no actor\n")
      }
      const body = Buffer.from(JSON.stringify({ ticket: auth.issue(phone, id) }))
      response.writeHead(200, { "content-type": "application/json", "content-length": body.length, "cache-control": "no-store" })
      return response.end(body)
    }
    if (["/", "/term", "/index.html", "/chat", "/chat/", "/chat/index.html"].includes(url.pathname)) {
      // Chat keeps one conversation: reuse the owner's most recently used actor.
      if (chat && !url.searchParams.get("actor") && store?.list) {
        const mine = store.list().filter((record) => record.owner === phone)
        const newest = mine.sort((a, b) => String(b.last_activity || b.created).localeCompare(String(a.last_activity || a.created)))[0]
        if (newest) {
          response.writeHead(302, { location: `/chat?actor=${newest.id}`, "content-length": 0, connection: "close" })
          return response.end()
        }
      }
      if (!url.searchParams.get("actor") && newActor) {
        if (!can({ phone }, "write", `people/${phone}/harnesses`)) return text(response, 403, "cannot create an actor\n")
        let record
        try {
          record = await newActor(phone)
        } catch (error) {
          LOG.error("could not create an actor for a bare page", error)
          return text(response, 502, `could not start an actor: ${error.message}\n`)
        }
        LOG.info(`bare page: created ${record.id}`)
        // A new Pi conversation in the new actor; old ones stay searchable.
        response.writeHead(302, { location: chat ? `/chat?actor=${record.id}` : `/?actor=${record.id}&exec=brayness`, "content-length": 0, connection: "close" })
        return response.end()
      }
      if (url.searchParams.get("actor")) {
        try {
          if (!allowed(phone, url.searchParams.get("actor"))) return text(response, 404, "no actor\n")
        } catch {
          return text(response, 404, "no actor\n")
        }
      }
      try {
        const page = readFileSync(join(chat ? chatRoot : pageRoot, "index.html"))
        response.writeHead(200, { "content-type": CONTENT_TYPES[".html"], "content-length": page.length, connection: "close" })
        return response.end(page)
      } catch {
        return text(response, 503, chat ? "no chat page: chat/ was not shipped\n" : "no terminal page: term/ was not shipped\n")
      }
    }
    if (url.pathname === "/pty") return text(response, 400, request.headers["sec-websocket-key"] ? "no actor\n" : "no websocket key\n")
    // The built page's hashed assets and the wasm.
    try {
      const root = realpathSync(chat ? chatRoot : pageRoot)
      const path = chat ? url.pathname.slice("/chat".length) : url.pathname
      const target = realpathSync(join(root, decodeURIComponent(path)))
      if (!target.startsWith(root + sep) || !statSync(target).isFile()) throw new Error()
      const body = readFileSync(target)
      response.writeHead(200, { "content-type": CONTENT_TYPES[extname(target)] ?? "application/octet-stream", "content-length": body.length, connection: "close" })
      response.end(body)
    } catch {
      text(response, 404, "no route\n")
    }
  })

  server.on("upgrade", (request, socket) => bridge(request, socket, streamPort, auth, allowed, same_origin))
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
  const lines = new vsock.Lines(stream)
  stream.write(`${JSON.stringify(hello)}\n`)
  const answer = (await lines.read(30))?.toString() ?? ""
  if (answer.includes('"error"') || !answer) {
    stream.destroy()
    throw new Error(answer || "the pty stream closed")
  }
  return { stream, lines }
}

async function bridge(request, socket, streamPort, auth, allowed, same_origin) {
  const url = new URL(request.url, "http://host")
  if (url.pathname !== "/pty") return refuse(socket, 400, "no route\n")
  const actor = url.searchParams.get("actor")
  if (!actor) return refuse(socket, 400, "no actor\n")
  const key = request.headers["sec-websocket-key"]
  if (!key) return refuse(socket, 400, "no websocket key\n")
  const phone = auth.owner(request.headers.cookie)
  if (!phone || !same_origin(request)) return refuse(socket, 403, "not signed in\n")
  try {
    if (!allowed(phone, actor)) return refuse(socket, 404, "no actor\n")
  } catch {
    return refuse(socket, 404, "no actor\n")
  }
  if (!auth.consume(url.searchParams.get("ticket"), phone, actor)) return refuse(socket, 403, "invalid ticket\n")

  let pty
  try {
    pty = await openPty(streamPort, { actor, pass: auth.pass(phone), cols: Number(url.searchParams.get("cols") ?? 80), rows: Number(url.searchParams.get("rows") ?? 24) })
  } catch (error) {
    LOG.warn(`pty bridge failed for ${actor}: ${error.message}`)
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
