// The guest control channel, from the host side.
//
// Firecracker maps guest vsock ports onto a host unix socket: write
// "CONNECT <port>\n", read "OK <n>\n", then it is a byte stream. On the other
// end is brayness-agent, one JSON request per line and one response per line.

import { connect as connectUnix } from "node:net"
import { VsockError } from "./errors.js"

export const VSOCK_PORT = 52
const HANDSHAKE_SECONDS = 10
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/**
 * Newline-framed reads that keep what follows a line, so a burst of frames or
 * a handshake followed by data is never dropped.
 */
export class Lines {
  constructor(socket, limit = 1 << 22) {
    this.socket = socket
    this.limit = limit
    this.buffer = Buffer.alloc(0)
    this.closed = false
    this.waiting = null
    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      this.wake()
    })
    socket.on("close", () => {
      this.closed = true
      this.wake()
    })
    socket.on("error", (error) => {
      this.error = error
      this.closed = true
      this.wake()
    })
  }

  wake() {
    const waiting = this.waiting
    this.waiting = null
    waiting?.()
  }

  /** One line without its newline, or null once the peer closed. */
  async read(seconds) {
    const deadline = seconds ? Date.now() + seconds * 1000 : Infinity
    for (;;) {
      const end = this.buffer.indexOf(10)
      if (end !== -1) {
        const line = this.buffer.subarray(0, end)
        this.buffer = this.buffer.subarray(end + 1)
        return line
      }
      if (this.buffer.length > this.limit) {
        const line = this.buffer
        this.buffer = Buffer.alloc(0)
        return line
      }
      if (this.closed) {
        if (this.buffer.length) {
          const line = this.buffer
          this.buffer = Buffer.alloc(0)
          return line
        }
        return null
      }
      const left = deadline - Date.now()
      if (left <= 0) throw new VsockError(`timed out after ${seconds}s`)
      await new Promise((done) => {
        const timer = Number.isFinite(left) ? setTimeout(done, left) : null
        this.waiting = () => {
          if (timer) clearTimeout(timer)
          done()
        }
      })
    }
  }

  /** Whatever arrived past the last line read, for handing the socket on. */
  rest() {
    const rest = this.buffer
    this.buffer = Buffer.alloc(0)
    this.socket.removeAllListeners("data")
    this.socket.removeAllListeners("close")
    this.socket.removeAllListeners("error")
    return rest
  }
}

/** A socket wired to the guest's `port`, handshake done, with its line reader. */
export async function connect(udsPath, port = VSOCK_PORT) {
  const socket = connectUnix(udsPath)
  await new Promise((done, fail) => {
    socket.once("connect", done)
    socket.once("error", (error) => fail(new VsockError(`cannot reach ${udsPath} (${error.code ?? error.message})`)))
  })
  const lines = new Lines(socket)
  socket.write(`CONNECT ${port}\n`)
  let ack
  try {
    ack = (await lines.read(HANDSHAKE_SECONDS))?.toString().trim() ?? ""
  } catch (error) {
    socket.destroy()
    throw error
  }
  // Firecracker closes outright when nothing in the guest listens.
  if (!ack.startsWith("OK ")) {
    socket.destroy()
    throw new VsockError(`no agent on port ${port} (firecracker said '${ack}')`)
  }
  return { socket, lines }
}

/** Run argv in the guest: { code, out, err } with Buffers. */
export async function execInGuest(udsPath, argv, { cwd = null, stdin = Buffer.alloc(0), timeout = 90, port = VSOCK_PORT } = {}) {
  const { socket, lines } = await connect(udsPath, port)
  let line
  try {
    socket.write(`${JSON.stringify({ argv, cwd, stdin_b64: Buffer.from(stdin).toString("base64") })}\n`)
    line = await lines.read(timeout)
  } finally {
    socket.destroy()
  }
  if (!line?.length) throw new VsockError(`agent closed the channel (argv=${JSON.stringify(argv)})`)
  const response = JSON.parse(line)
  return {
    code: response.exit_code,
    out: Buffer.from(response.stdout_b64, "base64"),
    err: Buffer.from(response.stderr_b64, "base64"),
  }
}

/** Run argv and return stdout as text, throwing if it failed. */
export async function runOk(udsPath, argv, options = {}) {
  const { code, out, err } = await execInGuest(udsPath, argv, options)
  if (code !== 0) throw new VsockError(`${JSON.stringify(argv)} exited ${code}: ${err.toString().trim()}`)
  return out.toString()
}

/** Wait until /bin/true answers: the guest is up and its agent started. */
export async function waitForAgent(udsPath, seconds = 60, port = VSOCK_PORT) {
  const deadline = Date.now() + seconds * 1000
  let last
  while (Date.now() < deadline) {
    try {
      await execInGuest(udsPath, ["/bin/true"], { timeout: 10, port })
      return
    } catch (error) {
      last = error
    }
    await sleep(500)
  }
  throw new VsockError(`no agent on ${udsPath} after ${seconds}s (${last?.message})`)
}
