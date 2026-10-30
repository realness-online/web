/**
 * The halo door, as a guest script sees it.
 *
 * One JSON object per line each way. The door is a unix socket in both
 * runtimes: a box creates it, and on Firecracker `realness-vsock.service`
 * relays it to the halo over vsock, so no guest script deals with vsock.
 */
import { connect } from 'node:net'

/** Where the door is. Overridable so a spec can point at its own. */
export const door_path = () =>
  process.env.REALNESS_DOOR ?? '/run/realness/door.sock'

/**
 * One request, one reply line, parsed.
 * @param {Record<string, unknown>} request
 * @param {{ timeout_ms?: number, timeout_error?: string }} [options]
 * @returns {Promise<Record<string, any>>}
 */
/** Requests that take a while (a read, a Chrome lease) pass their own. */
export const DOOR_TIMEOUT_MS = 120_000

export const ask = (
  request,
  { timeout_ms = DOOR_TIMEOUT_MS, timeout_error = 'timed out' } = {}
) =>
  new Promise((done, fail) => {
    const chunks = []
    const socket = connect(door_path())
    const timer = setTimeout(() => {
      socket.destroy()
      fail(new Error(timeout_error))
    }, timeout_ms)
    socket.on('error', error => {
      clearTimeout(timer)
      fail(
        new Error(
          `the halo did not answer (${/** @type {NodeJS.ErrnoException} */ (error).code ?? error.message})`
        )
      )
    })
    socket.on('connect', () => socket.write(`${JSON.stringify(request)}\n`))
    socket.on('data', chunk => {
      chunks.push(chunk)
      const text = Buffer.concat(chunks).toString()
      const end = text.indexOf('\n')
      if (end === -1) return
      clearTimeout(timer)
      socket.destroy()
      let reply
      try {
        reply = JSON.parse(text.slice(0, end))
      } catch {
        return fail(new Error('the halo sent no JSON'))
      }
      done(reply)
    })
    socket.on('close', () => {
      clearTimeout(timer)
      if (chunks.length === 0)
        fail(new Error('the halo closed without a reply'))
    })
  })

/**
 * One request that must succeed, or the script exits with the halo's reason.
 * @param {string} name the command, for the message
 * @param {Record<string, unknown>} request
 * @param {{ timeout_ms?: number, timeout_error?: string }} [options]
 */
export const ask_ok = async (name, request, options) => {
  const reply = await ask(request, options)
  if (!reply.ok) exit(`${name}: ${reply.error ?? 'no reply from the halo'}`)
  return reply
}

/** Say why, on stderr, with the exit code every failure here uses. */
export const exit = message => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
