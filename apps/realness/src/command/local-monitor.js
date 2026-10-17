/* eslint-disable no-await-in-loop -- Each frame completes before the next refresh or key. */
import { open } from 'node:fs/promises'
import { stripVTControlCharacters as strip_controls } from 'node:util'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { local_artifacts, probe_local } from './local-stack.js'
import {
  color_enabled,
  panel,
  paint,
  read_key,
  interval_for
} from './watch-terminal.js'

const LOG_BYTES = 4096
const LOG_LINES = 3
const REFRESH_MS = 1000
const FRAME_MARGIN = 5
const DEFAULT_COLUMNS = 100
const DEFAULT_ROWS = 30

/**
 * The last lines of one service log, or none when the stack reused it.
 * @param {import('./local-stack.js').LocalService} service
 * @returns {Promise<string[]>}
 */
const log_tail = async service => {
  if (service.reused) return []
  let file
  try {
    file = await open(path.join(local_artifacts, `${service.name}.log`))
    const { size } = await file.stat()
    const buffer = Buffer.alloc(Math.min(size, LOG_BYTES))
    await file.read(buffer, 0, buffer.length, Math.max(0, size - buffer.length))
    return strip_controls(buffer.toString('utf8'))
      .trim()
      .split('\n')
      .slice(-LOG_LINES)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  } finally {
    await file?.close()
  }
}

/**
 * One rendered service row.
 * @typedef {object} MonitorSection
 * @property {string} name
 * @property {string} state
 * @property {string} ownership
 * @property {string[]} lines
 */

/**
 * Render one local snapshot within the terminal bounds.
 * @param {MonitorSection[]} sections
 * @param {object} [options]
 * @param {string} [options.url]
 * @param {number} [options.columns]
 * @param {number} [options.rows]
 * @param {boolean} [options.on]
 */
export const local_frame = (
  sections,
  { url, columns = DEFAULT_COLUMNS, rows = DEFAULT_ROWS, on = false } = {}
) => {
  const lines = sections.flatMap(section => [
    ...panel({
      title: paint(`${section.name}  ${section.state}`, section.state, on),
      detail: section.ownership,
      lines: section.lines,
      width: columns,
      on
    }),
    ''
  ])
  const capacity = Math.max(0, rows - FRAME_MARGIN)
  return `${[
    paint('REALNESS LOCAL', 'running', on),
    url,
    ...lines.slice(0, capacity),
    'Ctrl-C/q stop local children  r refresh  u 15s  m 60s  h 5m',
    'The halo and reused services stay running.'
  ].join('\n')}\n`
}

/**
 * Reuse the existing watch controls and rendering; monitoring never owns processes.
 * @param {import('./local-stack.js').LocalService[]} services
 * @param {object} [options]
 * @param {string} [options.url]
 * @param {AbortSignal | null} [options.signal]
 * @param {NodeJS.WriteStream & { fd: 1 }} [options.stdout]
 * @param {NodeJS.ReadStream & { fd: 0 }} [options.stdin]
 */
export const monitor_local = async (
  services,
  { url, signal, stdout = process.stdout, stdin = process.stdin } = {}
) => {
  const on = color_enabled(process.env, stdout)
  let interval = REFRESH_MS
  try {
    while (!signal?.aborted) {
      const sections = await Promise.all(
        services.map(async service => {
          if (service.error) throw new Error(service.error)
          const [health, lines] = await Promise.all([
            probe_local(service),
            log_tail(service)
          ])
          const state = health.ready ? 'running' : 'starting'
          let ownership = `PID ${service.pid}`
          if (service.reused) ownership = 'already running'
          if (service.persistent) ownership = 'halo stays up'
          return { name: service.name, state, ownership, lines }
        })
      )
      const frame = local_frame(sections, {
        url,
        columns: stdout.columns,
        rows: stdout.rows,
        on
      })
      stdout.write(`${stdout.isTTY ? '\x1b[2J\x1b[H' : ''}${frame}`)
      const waiting = new AbortController()
      const combined = AbortSignal.any(
        signal ? [signal, waiting.signal] : [waiting.signal]
      )
      let key
      try {
        key = await Promise.race([
          stdin.isTTY ? read_key(stdin, combined) : new Promise(() => {}),
          delay(interval, null, { signal: combined })
        ])
      } catch (error) {
        if (error.name !== 'AbortError') throw error
      } finally {
        waiting.abort()
      }
      if (key === '\u0003' || key === 'q') break
      if (key) interval = interval_for(key.trim().toLowerCase(), interval)
    }
  } finally {
    stdin.setRawMode?.(false)
    stdin.pause?.()
  }
}
