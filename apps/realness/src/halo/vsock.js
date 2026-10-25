import { connect as connect_unix } from 'node:net'
import { VsockError } from './errors.js'
import { Lines as SharedLines } from '#root/lib/lines.js'
import { MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- polling waits between tries */

const RETRY_MS = 500

export const VSOCK_PORT = 52
const HANDSHAKE_SECONDS = 10
const EXEC_TIMEOUT_SECONDS = 90
const AGENT_WAIT_SECONDS = 60
const AGENT_PROBE_SECONDS = 10
const sleep = ms =>
  new Promise(done => {
    setTimeout(done, ms)
  })

/** Line reads on a guest socket; a timeout is a VsockError. */
export class Lines extends SharedLines {
  timed_out(seconds) {
    return new VsockError(`timed out after ${seconds}s`)
  }
}

/**
 * A socket wired to the guest's `port`, handshake done, with its line reader.
 * @param {string} uds_path - Firecracker's vsock Unix socket
 * @param {number} [port]
 * @returns {Promise<{ socket: import('node:net').Socket, lines: Lines }>}
 */
export const connect = async (uds_path, port = VSOCK_PORT) => {
  const socket = connect_unix(uds_path)
  await new Promise((done, fail) => {
    socket.once('connect', done)
    socket.once('error', error =>
      fail(
        new VsockError(
          `cannot reach ${uds_path} (${/** @type {NodeJS.ErrnoException} */ (error).code ?? error.message})`
        )
      )
    )
  })
  const lines = new Lines(socket)
  socket.write(`CONNECT ${port}\n`)
  let ack
  try {
    ack = (await lines.read(HANDSHAKE_SECONDS))?.toString().trim() ?? ''
  } catch (error) {
    socket.destroy()
    throw error
  }
  if (!ack.startsWith('OK ')) {
    socket.destroy()
    throw new VsockError(`no agent on port ${port} (firecracker said '${ack}')`)
  }
  return { socket, lines }
}

/**
 * Run argv in the guest: { code, out, err } with Buffers.
 * @param {string} uds_path
 * @param {string[]} argv
 * @param {object} [options]
 * @param {string | null} [options.cwd] null runs in the agent's own directory
 * @param {Buffer | string} [options.stdin]
 * @param {number} [options.timeout] seconds
 * @param {number} [options.port]
 * @returns {Promise<{ code: number, out: Buffer, err: Buffer }>}
 */
export const exec_in_guest = async (
  uds_path,
  argv,
  {
    cwd = null,
    stdin = Buffer.alloc(0),
    timeout = EXEC_TIMEOUT_SECONDS,
    port = VSOCK_PORT
  } = {}
) => {
  const { socket, lines } = await connect(uds_path, port)
  let line
  try {
    socket.write(
      `${JSON.stringify({ argv, cwd, stdin_b64: Buffer.from(stdin).toString('base64') })}\n`
    )
    line = await lines.read(timeout)
  } finally {
    socket.destroy()
  }
  if (!line?.length)
    throw new VsockError(
      `agent closed the channel (argv=${JSON.stringify(argv)})`
    )
  const response = JSON.parse(line)
  return {
    code: response.exit_code,
    out: Buffer.from(response.stdout_b64, 'base64'),
    err: Buffer.from(response.stderr_b64, 'base64')
  }
}

/**
 * Run argv in the guest and report output as it arrives. The agent sends
 * `stdout` and `stderr` frames, then one `exit` frame. Destroying the socket
 * stops the command in the guest.
 * @param {string} uds_path
 * @param {string[]} argv
 * @param {object} [options]
 * @param {string | null} [options.cwd]
 * @param {Buffer} [options.stdin]
 * @param {number} [options.timeout] seconds; the guest stops the command
 * @param {number} [options.port]
 * @param {(chunk: { stream: 'stdout' | 'stderr', data: Buffer }) => void} [options.on_output]
 * @param {AbortSignal} [options.signal]
 * @param {Record<string, string>} [options.env]
 * @param {boolean} [options.inherit_env]
 * @param {{ afterBytes: number, afterLines: number }} [options.spill]
 * @returns {Promise<{ code: number, error?: string, spill_path?: string }>}
 */
export const exec_in_guest_stream = async (
  uds_path,
  argv,
  {
    cwd = null,
    stdin = Buffer.alloc(0),
    timeout = EXEC_TIMEOUT_SECONDS,
    port = VSOCK_PORT,
    on_output = () => {},
    signal,
    env,
    inherit_env,
    spill
  } = {}
) => {
  const { socket, lines } = await connect(uds_path, port)
  const stop = () => socket.destroy()
  if (signal?.aborted) stop()
  else signal?.addEventListener('abort', stop, { once: true })
  try {
    socket.write(
      `${JSON.stringify({
        argv,
        cwd,
        stdin_b64: Buffer.from(stdin).toString('base64'),
        stream: true,
        timeout,
        env,
        inherit_env,
        spill
      })}\n`
    )
    for (;;) {
      const line = await lines.read()
      if (!line?.length)
        throw new VsockError(
          `agent closed the channel (argv=${JSON.stringify(argv)})`
        )
      const event = JSON.parse(line.toString())
      if (event.type === 'exit')
        return {
          code: event.exit_code,
          ...(event.error ? { error: event.error } : {}),
          ...(event.spill_path ? { spill_path: event.spill_path } : {})
        }
      if (event.type === 'stdout' || event.type === 'stderr')
        on_output({
          stream: event.type,
          data: Buffer.from(event.data_b64 ?? '', 'base64')
        })
    }
  } finally {
    signal?.removeEventListener('abort', stop)
    socket.destroy()
  }
}

/**
 * Run argv and return stdout as text, throwing if it failed.
 * @param {string} uds_path
 * @param {string[]} argv
 * @param {Parameters<typeof exec_in_guest>[2]} [options]
 * @returns {Promise<string>}
 */
export const run_ok = async (uds_path, argv, options = {}) => {
  const { code, out, err } = await exec_in_guest(uds_path, argv, options)
  if (code !== 0)
    throw new VsockError(
      `${JSON.stringify(argv)} exited ${code}: ${err.toString().trim()}`
    )
  return out.toString()
}

/**
 * Wait until /bin/true answers: the guest is up and its agent started.
 * @param {string} uds_path
 * @param {number} [seconds]
 * @param {number} [port]
 */
export const wait_for_agent = async (
  uds_path,
  seconds = AGENT_WAIT_SECONDS,
  port = VSOCK_PORT
) => {
  const deadline = Date.now() + seconds * MS_PER_SECOND
  let last
  while (Date.now() < deadline) {
    try {
      await exec_in_guest(uds_path, ['/bin/true'], {
        timeout: AGENT_PROBE_SECONDS,
        port
      })
      return
    } catch (error) {
      last = error
    }
    await sleep(RETRY_MS)
  }
  throw new VsockError(
    `no agent on ${uds_path} after ${seconds}s (${last?.message})`
  )
}
