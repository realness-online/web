/**
 * Logs each main-thread freeze over 200 ms to `artifacts/audit/lag.log`,
 * with the last pi event before it, and warns in pi when one passes 1 s.
 * Both checks run while the agent works and for 3 minutes after it settles,
 * then stop until the next pi event, so a sleeping Mac logs nothing.
 * After the first freeze over 2 s while the person waits, it records a CPU
 * profile of the next turn to `artifacts/audit/profiles/`, once per process.
 * Each minute it sums the memory of pi and every process under it, logs the
 * total with the biggest processes, and warns once when it passes 4 GB.
 * Each typed submit logs its text and the last raw terminal keys before it
 * to `artifacts/audit/keys.log`, to show what sent it, with the gap in ms
 * before each key, then the keys of the second after it.
 */
import { execFile } from 'node:child_process'
import { appendFileSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { Session } from 'node:inspector/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const TICK_MS = 100
const LOG_MS = 200
const WARN_MS = 1000
const PROFILE_MS = 2000
const ROTATE_BYTES = 1024 * 1024
const MEMORY_TICK_MS = 60_000
export const SETTLE_MS = 3 * 60_000
const MEMORY_WARN_MB = 4096
const KEEP_KEYS = 20
const KEEP_CHARS = 16
const AFTER_MS = 1000
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

/**
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi
 * @param {string} dir
 */
export default function audit(pi, dir = join(import.meta.dirname, '../../../artifacts/audit')) {
  const file = join(dir, 'lag.log')
  const keys_file = join(dir, 'keys.log')
  /** @type {Array<{ data: string; at: number; }>} */
  const keys = []
  /** @type {{ text: string; at: number; keys: Array<{ data: string; at: number; }>; timer: ReturnType<typeof setTimeout>; } | undefined} */
  let after
  /** @param {Array<{ data: string; at: number; }>} list @param {number} from */
  const key_fields = (list, from) =>
    `keys=${JSON.stringify(list.map(key => key.data))} gaps=${JSON.stringify(
      list.map((key, i) => Math.round(key.at - (i ? list[i - 1].at : from)))
    )}`
  const write_after = () => {
    if (!after) return
    clearTimeout(after.timer)
    write(`after text=${JSON.stringify(after.text)} ${key_fields(after.keys, after.at)}`, keys_file)
    after = undefined
  }
  /** @type {(() => void) | undefined} */
  let stop_keys
  let last_event = 'none'
  /** @type {{ ui: { notify: (m: string, l: "warning") => void; }; hasUI: boolean; } | undefined} */
  let ui_ctx
  /**
   * @param {string} text
   * @param {string} to
   */
  const write = (text, to = file) => {
    mkdirSync(dir, { recursive: true })
    if ((statSync(to, { throwIfNoEntry: false })?.size ?? 0) > ROTATE_BYTES) renameSync(to, `${to}.1`)
    appendFileSync(to, `${new Date().toISOString()} pid=${process.pid} ${text}\n`)
  }
  let warned_memory = false
  const check_memory = async () => {
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
  }
  /** @type {number | undefined} */
  let settled_at = performance.now()
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let lag_timer
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let memory_timer
  let last = performance.now()
  const stop = () => {
    clearInterval(lag_timer)
    clearInterval(memory_timer)
    lag_timer = undefined
    memory_timer = undefined
  }
  const start = () => {
    if (lag_timer) return
    last = performance.now()
    lag_timer = setInterval(() => {
      const now = performance.now()
      if (settled_at !== undefined && now - settled_at > SETTLE_MS) return stop()
      const lag = Math.round(now - last - TICK_MS)
      last = now
      if (lag < LOG_MS) return
      write(`lag=${lag}ms after=${last_event}`)
      if (lag >= PROFILE_MS && last_event !== 'agent_settled' && profile === 'idle') profile = 'armed'
      if (lag >= WARN_MS && last_event !== 'agent_settled' && ui_ctx?.hasUI)
        ui_ctx.ui.notify(`pi froze ${(lag / 1000).toFixed(1)}s after ${last_event}`, 'warning')
    }, TICK_MS)
    lag_timer.unref()
    memory_timer = setInterval(check_memory, MEMORY_TICK_MS)
    memory_timer.unref()
  }
  for (const name of EVENTS)
    pi.on(name, (event, ctx) => {
      ui_ctx = ctx
      last_event = name.startsWith('tool_') ? `${name}:${event.toolName}` : name
      settled_at = name === 'agent_settled' || name === 'session_start' ? performance.now() : undefined
      start()
    })
  /** @type {'idle' | 'armed' | 'running' | 'done'} */
  let profile = 'idle'
  /** @type {Session | undefined} */
  let profiler
  pi.on('turn_start', async () => {
    if (profile !== 'armed') return
    profile = 'running'
    profiler = new Session()
    profiler.connect()
    await profiler.post('Profiler.enable')
    await profiler.post('Profiler.start')
  })
  const save_profile = async () => {
    if (profile !== 'running' || !profiler) return
    profile = 'done'
    const session = profiler
    profiler = undefined
    const { profile: data } = await session.post('Profiler.stop')
    session.disconnect()
    const to = join(dir, 'profiles', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.cpuprofile`)
    mkdirSync(join(dir, 'profiles'), { recursive: true })
    writeFileSync(to, JSON.stringify(data))
    write(`profile=${to}`)
  }
  pi.on('turn_end', save_profile)
  pi.on('session_start', (event, ctx) => {
    if (!ctx.hasUI || stop_keys) return
    stop_keys = ctx.ui.onTerminalInput(data => {
      const key = { data: data.length > KEEP_CHARS ? `<${data.length} chars>` : data, at: performance.now() }
      if (after) return void after.keys.push(key)
      keys.push(key)
      if (keys.length > KEEP_KEYS) keys.shift()
    })
  })
  pi.on('input', event => {
    if (event.source !== 'interactive') return
    write_after()
    const text = event.text.slice(0, 80)
    write(`submit text=${JSON.stringify(text)} ${key_fields(keys, keys[0]?.at ?? 0)}`, keys_file)
    keys.length = 0
    const timer = setTimeout(write_after, AFTER_MS)
    timer.unref()
    after = { text, at: performance.now(), keys: [], timer }
  })
  start()
  pi.on('session_shutdown', () => {
    stop()
    write_after()
    stop_keys?.()
    stop_keys = undefined
    return save_profile()
  })
}
