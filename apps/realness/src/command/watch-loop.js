import { setTimeout as delay } from 'node:timers/promises'
import { health_snapshot } from './watch-health.js'
import {
  color_enabled,
  frame,
  frame_rows,
  interval_for,
  read_key
} from './watch-terminal.js'
import { MS_PER_MINUTE } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- the watch loop draws one frame, then waits for a key */

const QUIET_MS = 2 * MS_PER_MINUTE
const DEFAULT_COLUMNS = 100
const DEFAULT_ROWS = 30
const SCROLL_STEP = 5

export const DEFAULT_INTERVAL_MS = 60_000

/**
 * Draw frames until `signal` aborts. `read` defaults to a health snapshot;
 * tests pass their own, so no service is contacted.
 */
export const watch = async ({
  read,
  store,
  token = null,
  ledger,
  named = [],
  records = {},
  service = null,
  cloud = null,
  quiet_ms = QUIET_MS,
  interval_ms = DEFAULT_INTERVAL_MS,
  stdout = process.stdout,
  stdin = process.stdin,
  signal = null,
  now = () => new Date(),
  clear = true
} = {}) => {
  const on = color_enabled(process.env, stdout)
  const read_snapshot =
    read ??
    (() =>
      health_snapshot({
        store,
        token,
        ledger,
        named,
        records,
        service,
        cloud,
        quiet_ms
      }))
  let interval = interval_ms
  let snapshot = null
  let message = null
  let offset = 0
  let details = false

  const draw = () => {
    const columns = stdout.columns ?? DEFAULT_COLUMNS
    const rows = stdout.rows ?? DEFAULT_ROWS
    offset = Math.min(
      offset,
      Math.max(
        0,
        frame_rows(snapshot, columns, on, details).length -
          Math.max(0, rows - 5)
      )
    )
    if (clear) stdout.write('\x1b[2J\x1b[H')
    stdout.write(
      frame({
        snapshot,
        width: columns,
        height: rows,
        interval_ms: interval,
        now: Date.now(),
        on,
        message,
        offset,
        details
      })
    )
  }

  const once = async () => {
    try {
      snapshot = await read_snapshot()
      message = null
    } catch (error) {
      message = `read failed: ${error.message}`
    }
    draw()
  }

  await once()
  while (!signal?.aborted) {
    const waiting = new AbortController()
    const combined = signal
      ? AbortSignal.any([signal, waiting.signal])
      : waiting.signal
    const key = await Promise.race([
      read_key(stdin, combined),
      delay(interval, null, { signal: combined }).catch(error => {
        if (error.name === 'AbortError') return 'abort'
        throw error
      })
    ]).finally(() => waiting.abort())
    if (signal?.aborted || key === 'abort') break
    if (key === '\u0003' || key === 'q') break
    if (key === 'd') {
      details = !details
      offset = 0
      draw()
      continue
    }
    if (key === 'j' || key === 'k') {
      offset = Math.max(0, offset + (key === 'j' ? SCROLL_STEP : -SCROLL_STEP))
      draw()
      continue
    }
    if (key !== null)
      interval = interval_for(key.trim().toLowerCase(), interval)
    await once()
  }
  if (stdin.setRawMode) stdin.setRawMode(false)
  stdin.pause?.()
  if (clear) stdout.write('\x1b[2J\x1b[H')
  return snapshot
}

export { frame }
