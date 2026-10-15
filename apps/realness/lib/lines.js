import { MIB, MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- each read waits for the line before it */

const LIMIT_MIB = 4
const NEWLINE = 10
/**
 * Newline-framed reads that keep what follows a line, so a burst of frames or
 * a handshake followed by data is never dropped.
 */
export class Lines {
  constructor(socket, limit = 1 << (LIMIT_MIB * MIB)) {
    this.socket = socket
    this.limit = limit
    this.buffer = Buffer.alloc(0)
    this.closed = false
    this.waiting = null
    socket.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk])
      this.wake()
    })
    socket.on('close', () => {
      this.closed = true
      this.wake()
    })
    socket.on('error', error => {
      this.error = error
      this.closed = true
      this.wake()
    })
  }

  /** The error a read throws when its time runs out. */
  timed_out(seconds) {
    return new Error(`timed out after ${seconds}s`)
  }

  wake() {
    const { waiting } = this
    this.waiting = null
    waiting?.()
  }

  /** One line without its newline, or null once the peer closed. */
  async read(seconds) {
    const deadline = seconds ? Date.now() + seconds * MS_PER_SECOND : Infinity
    for (;;) {
      const end = this.buffer.indexOf(NEWLINE)
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
      if (left <= 0) throw this.timed_out(seconds)
      /** @type {Promise<void>} */
      const waiting = new Promise(done => {
        const timer = Number.isFinite(left) ? setTimeout(done, left) : null
        this.waiting = () => {
          if (timer) clearTimeout(timer)
          done()
        }
      })
      await waiting
    }
  }

  /** Whatever arrived past the last line read, for handing the socket on. */
  rest() {
    const rest = this.buffer
    this.buffer = Buffer.alloc(0)
    this.socket.removeAllListeners('data')
    this.socket.removeAllListeners('close')
    this.socket.removeAllListeners('error')
    return rest
  }
}
