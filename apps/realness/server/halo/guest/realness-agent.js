#!/usr/bin/env node
/**
 * Realness actor agent - the guest end of the vsock control channel.
 *
 * One JSON object per line in, one per line out, over stdio. socat owns the
 * vsock listener and hands each connection to one copy of this process (see
 * realness-vsock.service).
 *
 *   request   {"argv": ["curl","-sS","https://example.com"], "cwd": "/realness",
 *              "stdin_b64": ""}
 *   response  {"exit_code": 0, "stdout_b64": "...", "stderr_b64": "..."}
 *
 * With "stream": true the response is one JSON object per line as output
 * arrives, then the exit:
 *
 *   {"type": "stdout", "data_b64": "..."}
 *   {"type": "stderr", "data_b64": "..."}
 *   {"type": "exit", "exit_code": 0}
 *
 * "timeout" seconds stops a streaming command and reports 124. Closing the
 * channel, which is how the halo cancels, kills it too.
 *
 * Payloads are base64 so binary output and raw newlines survive a line-oriented
 * channel. There is no shell: argv is exec'd directly, by design. An actor that
 * wants a shell asks for one (["/bin/bash","-c",...]).
 *
 * Node, not Python: the image carries no interpreter it does not need.
 */
import { spawn } from 'node:child_process'
import {
  createWriteStream as create_write_stream,
  mkdirSync as mkdir_sync
} from 'node:fs'
import { join } from 'node:path'
import { randomUUID as random_uuid } from 'node:crypto'
import { createInterface as create_interface } from 'node:readline'

const MS_PER_SECOND = 1000

const TIMEOUT_EXIT = 124
const SPAWN_EXIT = 127
const NEWLINE = '\n'.charCodeAt(0)
const DEFAULT_CWD = '/realness'

/** The environment a command runs with: this one, HOME pointed at the harness. */
const environment = request => ({
  ...(request.inherit_env === false
    ? {}
    : { ...process.env, HOME: DEFAULT_CWD }),
  ...request.env
})

const decode = value => Buffer.from(value ?? '', 'base64')

/** One base64 line for `bytes`, without its newline. */
const encode = bytes => bytes.toString('base64')

/** Reply with one JSON line. */
const reply = value => process.stdout.write(`${JSON.stringify(value)}\n`)

/**
 * Hand a command its stdin. One that exits without reading it closes the pipe
 * early; that is the command's choice, not a failed request.
 * @param {import('node:child_process').ChildProcess} child
 * @param {AgentRequest} request
 */
const feed = (child, request) => {
  child.stdin?.on('error', () => {})
  child.stdin?.end(decode(request.stdin_b64))
}

/**
 * A command's fixed output and exit, for a request without "stream".
 * @param {AgentRequest} request
 */
const run = request =>
  new Promise(done => {
    const child = spawn(request.argv[0], request.argv.slice(1), {
      cwd: request.cwd || DEFAULT_CWD,
      env: environment(request),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    const out = []
    const err = []
    child.stdout.on('data', chunk => out.push(chunk))
    child.stderr.on('data', chunk => err.push(chunk))
    child.on('error', error => done({ error }))
    child.on('close', code =>
      done({
        exit_code: code ?? 1,
        stdout_b64: encode(Buffer.concat(out)),
        stderr_b64: encode(Buffer.concat(err))
      })
    )
    feed(child, request)
  })

/**
 * A spill file for output too big to stream whole: created once the threshold
 * is crossed, then every later chunk lands in it.
 * @param {{ afterBytes: number, afterLines: number }} limit
 */
const spiller = limit => {
  const root = process.env.REALNESS_ROOT ?? DEFAULT_CWD
  const directory = join(root, 'artifacts', 'realness')
  /** @type {import('node:fs').WriteStream | null} */
  let file = null
  /** @type {string | null} */
  let path = null
  /** @type {Buffer[]} */
  let prefix = []
  let bytes = 0
  let lines = 0
  return {
    get path() {
      return path
    },
    /** Offer one chunk; returns nothing. */
    offer(chunk) {
      bytes += chunk.length
      lines += chunk.toString('latin1').split('\n').length - 1
      if (file) return file.write(chunk)
      prefix.push(chunk)
      const counted = lines + (chunk.at(-1) === NEWLINE ? 0 : 1)
      if (bytes <= limit.afterBytes && counted <= limit.afterLines) return
      mkdir_sync(directory, { recursive: true })
      path = join(directory, `exec-${random_uuid()}.log`)
      file = create_write_stream(path)
      for (const part of prefix) file.write(part)
      prefix = []
    },
    close() {
      file?.end()
    }
  }
}

/**
 * @typedef {object} AgentRequest
 * @property {string[]} argv program, then its arguments; no shell
 * @property {string} [cwd]
 * @property {string} [stdin_b64]
 * @property {boolean} [stream]
 * @property {Record<string, string>} [env]
 * @property {boolean} [inherit_env]
 * @property {number} [timeout] seconds
 * @property {{ afterBytes?: number, afterLines?: number }} [spill]
 */

/**
 * Stream one command's output as JSON lines, then its exit. Resolves after the
 * exit line is written.
 * @param {AgentRequest} request
 */
const stream = async request => {
  const spill = request.spill
    ? spiller({
        afterBytes: Number(request.spill.afterBytes ?? 0),
        afterLines: Number(request.spill.afterLines ?? 0)
      })
    : null
  const child = spawn(request.argv[0], request.argv.slice(1), {
    cwd: request.cwd || DEFAULT_CWD,
    env: environment(request),
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let timed_out = false
  let output_failed = false
  /** @type {Error | null} */
  let spawn_error = null
  /** @type {NodeJS.Timeout | null} */
  let timer = null
  const kill = () => {
    try {
      if (child.pid) process.kill(-child.pid, 'SIGKILL')
    } catch {}
  }
  cancel.current = kill
  const emit = (event, chunk) => {
    if (spill && chunk) spill.offer(chunk)
    reply(event)
  }
  const pump = (source, kind) => {
    source.on('data', chunk =>
      emit({ type: kind, data_b64: encode(chunk) }, chunk)
    )
    source.on('error', () => {
      output_failed = true
      kill()
    })
  }
  pump(child.stdout, 'stdout')
  pump(child.stderr, 'stderr')
  child.on('error', error => {
    spawn_error = error
    output_failed = true
    kill()
  })
  child.stdin.on('error', () => {})
  feed(child, request)
  const seconds = Number(request.timeout)
  if (Number.isFinite(seconds) && seconds > 0)
    timer = setTimeout(() => {
      timed_out = true
      kill()
    }, seconds * MS_PER_SECOND)
  const code = await new Promise(done => {
    child.on('close', done)
  })
  if (timer) clearTimeout(timer)
  cancel.current = null
  spill?.close()
  const result = {
    type: 'exit',
    exit_code: timed_out ? TIMEOUT_EXIT : (code ?? 1)
  }
  if (spawn_error) {
    emit({
      type: 'stderr',
      data_b64: encode(Buffer.from(/** @type {Error} */ (spawn_error).message))
    })
    result.exit_code = SPAWN_EXIT
    result.error = 'spawn_error'
  } else if (timed_out) result.error = 'timeout'
  else if (output_failed) result.error = 'unknown'
  if (spill?.path) result.spill_path = spill.path
  emit(result)
}

/** A streaming command to kill if the channel closes (the halo's cancel). */
/** @type {{ current: (() => void) | null }} */
const cancel = { current: null }

/** One request line: stream it, or answer in one reply. */
const handle = async line => {
  /** @type {AgentRequest | null} */
  let request = null
  try {
    request = JSON.parse(line)
    if (request?.stream === true) {
      await stream(/** @type {AgentRequest} */ (request))
      process.stdin.destroy()
      return false
    }
    const result = await run(/** @type {AgentRequest} */ (request))
    if (result.error) throw result.error
    reply(result)
  } catch (error) {
    if (request?.stream === true) {
      reply({ type: 'stderr', data_b64: encode(Buffer.from(String(error))) })
      reply({ type: 'exit', exit_code: 127, error: 'spawn_error' })
      return false
    }
    reply({
      exit_code: 127,
      stdout_b64: '',
      stderr_b64: encode(Buffer.from(String(error?.message ?? error)))
    })
  }
  return true
}

const lines = create_interface({ input: process.stdin, crlfDelay: Infinity })
process.stdin.on('end', () => cancel.current?.())
for await (const line of lines) {
  if (!line.trim()) continue
  // eslint-disable-next-line no-await-in-loop -- requests arrive one at a time
  // eslint-disable-next-line no-await-in-loop -- requests arrive one at a time
  const keep_going = await handle(line)
  if (!keep_going) break
}
