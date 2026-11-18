/**
 * Logs each main-thread freeze over 200 ms to `artifacts/lag-probe/lag.log`,
 * with the last pi event before it, and warns in pi when one passes 1 s.
 * Each minute it sums the memory of pi and every process under it, logs the
 * total with the biggest processes, and warns once when it passes 4 GB.
 */
import { execFile } from 'node:child_process'
import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const TICK_MS = 100
const LOG_MS = 200
const WARN_MS = 1000
const ROTATE_BYTES = 1024 * 1024
const MEMORY_TICK_MS = 60_000
const MEMORY_WARN_MB = 4096
const EVENTS = [
  'session_start',
  'input',
  'before_agent_start',
  'agent_start',
  'turn_start',
  'message_start',
  'message_end',
  'tool_call',
  'tool_result',
  'turn_end',
  'agent_end',
  'agent_settled'
]

/**
 * Memory of a process and all its descendants, from `ps -Ao pid=,ppid=,rss=,comm=`.
 * @param {string} ps
 * @param {number} root
 * @returns {{ total_mb: number; count: number; top: Array<{ pid: number; mb: number; name: string; }>; }}
 */
export const tree_memory = (ps, root) => {
  const rows = ps
    .trim()
    .split('\n')
    .map(line => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/))
    .filter(match => match !== null)
    .map(([, pid, ppid, rss, name]) => ({
      pid: Number(pid),
      ppid: Number(ppid),
      mb: Math.round(Number(rss) / 1024),
      name: name.split('/').pop() ?? name
    }))
  const inside = new Set([root])
  let grew = true
  while (grew) {
    grew = false
    for (const row of rows)
      if (!inside.has(row.pid) && inside.has(row.ppid)) {
        inside.add(row.pid)
        grew = true
      }
  }
  const tree = rows.filter(row => inside.has(row.pid)).sort((a, b) => b.mb - a.mb)
  return {
    total_mb: tree.reduce((sum, row) => sum + row.mb, 0),
    count: tree.length,
    top: tree.slice(0, 3).map(({ pid, mb, name }) => ({ pid, mb, name }))
  }
}

/** @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi */
export default function lag_probe(pi) {
  const dir = join(import.meta.dirname, '../../../artifacts/lag-probe')
  const file = join(dir, 'lag.log')
  let last_event = 'none'
  /** @type {{ ui: { notify: (m: string, l: "warning") => void; }; hasUI: boolean; } | undefined} */
  let ui_ctx
  for (const name of EVENTS)
    pi.on(name, (event, ctx) => {
      ui_ctx = ctx
      last_event = name.startsWith('tool_') ? `${name}:${event.toolName}` : name
    })
  /** @param {string} text */
  const write = text => {
    mkdirSync(dir, { recursive: true })
    if ((statSync(file, { throwIfNoEntry: false })?.size ?? 0) > ROTATE_BYTES) renameSync(file, `${file}.1`)
    appendFileSync(file, `${new Date().toISOString()} pid=${process.pid} ${text}\n`)
  }
  let warned_memory = false
  const memory_timer = setInterval(async () => {
    const { stdout } = await promisify(execFile)('ps', ['-Ao', 'pid=,ppid=,rss=,comm='])
    const { total_mb, count, top } = tree_memory(stdout, process.pid)
    if (total_mb < MEMORY_WARN_MB / 2) return
    const biggest = top.map(row => `${row.name}(${row.pid})=${row.mb}MB`).join(' ')
    write(`memory=${total_mb}MB processes=${count} top: ${biggest}`)
    if (total_mb < MEMORY_WARN_MB || warned_memory || !ui_ctx?.hasUI) return
    warned_memory = true
    ui_ctx.ui.notify(
      `pi and its ${count - 1} processes use ${(total_mb / 1024).toFixed(1)} GB; biggest: ${top[0].name}`,
      'warning'
    )
  }, MEMORY_TICK_MS)
  memory_timer.unref()
  let last = performance.now()
  const lag_timer = setInterval(() => {
    const now = performance.now()
    const lag = Math.round(now - last - TICK_MS)
    last = now
    if (lag < LOG_MS) return
    write(`lag=${lag}ms after=${last_event}`)
    if (lag >= WARN_MS && ui_ctx?.hasUI)
      ui_ctx.ui.notify(`pi froze ${(lag / 1000).toFixed(1)}s after ${last_event}`, 'warning')
  }, TICK_MS)
  lag_timer.unref()
  pi.on('session_shutdown', () => {
    clearInterval(memory_timer)
    clearInterval(lag_timer)
  })
}
