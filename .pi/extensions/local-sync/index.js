/**
 * Local Sync Extension
 *
 * The Mac's sync server starts with the first pi session and stops when the
 * last one closes. A server another program started stays up.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { spawn } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { local_plan } from 'realness/local/stack'
import { local_up } from 'realness/files/target'

const harness = fileURLToPath(new URL('../../..', import.meta.url))
const state_dir = join(harness, '.pi/agent/state/local-sync')
const READY_TRIES = 75
const READY_MS = 200
const MARKER = '.json'

/** Whether a process still holds that pid. */
export const alive = (/** @type {number} */ pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Every session still open, with markers left by dead processes removed. */
export const live_sessions = (/** @type {string} */ dir, /** @type {(pid: number) => boolean} */ alive_fn = alive) => {
  mkdir_sync(dir, { recursive: true })
  /** @type {number[]} */
  const pids = []
  for (const name of readdir_sync(dir)) {
    if (!name.endsWith(MARKER)) continue
    const pid = Number(name.slice(0, -MARKER.length))
    if (alive_fn(pid)) pids.push(pid)
    else rm_sync(join(dir, name), { force: true })
  }
  return pids
}

export const claim_session = (/** @type {number} */ pid, /** @type {string} */ dir) => {
  mkdir_sync(dir, { recursive: true })
  write_file_sync(join(dir, `${pid}${MARKER}`), JSON.stringify({ pid, at: Date.now() }))
}

export const release_session = (/** @type {number} */ pid, /** @type {string} */ dir) =>
  rm_sync(join(dir, `${pid}${MARKER}`), { force: true })

/** The pid of the server this harness started, or null. */
export const read_server = (/** @type {string} */ file, /** @type {(pid: number) => boolean} */ alive_fn = alive) => {
  try {
    const { pid } = JSON.parse(read_file_sync(file, 'utf8'))
    return alive_fn(pid) ? pid : null
  } catch {
    return null
  }
}

export const write_server = (/** @type {string} */ file, /** @type {number} */ pid) => {
  mkdir_sync(dirname(file), { recursive: true })
  write_file_sync(file, JSON.stringify({ pid, at: Date.now() }))
}

/** Take the start lock for this pid; a lock a dead process left is taken over. */
export const take_start = (
  /** @type {string} */ file,
  /** @type {number} */ pid,
  /** @type {(pid: number) => boolean} */ alive_fn = alive
) => {
  mkdir_sync(dirname(file), { recursive: true })
  try {
    write_file_sync(file, String(pid), { flag: 'wx' })
    return true
  } catch {
    if (alive_fn(Number(read_file_sync(file, 'utf8')))) return false
    write_file_sync(file, String(pid))
    return true
  }
}

export const drop_start = (/** @type {string} */ file, /** @type {number} */ pid) => {
  try {
    if (read_file_sync(file, 'utf8') !== String(pid)) return
    rm_sync(file, { force: true })
  } catch {}
}

/** Stop a detached child and the processes it started. */
export const signal = (/** @type {number} */ pid, /** @type {NodeJS.Signals} */ name) => {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, name)
      return true
    } catch {}
  }
  return false
}

/** The local stack's sync service, as `npm run local` starts it. */
export const start_plan = () => {
  const service = local_plan().services.find(one => one.name === 'sync')
  const child = spawn(service?.command ?? 'npm', service?.args ?? [], {
    cwd: service?.cwd,
    env: { ...process.env, ...service?.env },
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  return child
}

/** Start the server for this session when it is down and no other start is under way. */
export const ensure_server = async ({
  sessions,
  record,
  starting,
  pid = process.pid,
  up = local_up,
  launch = start_plan,
  alive_fn = alive,
  tries = READY_TRIES,
  wait_ms = READY_MS
}) => {
  if (!live_sessions(sessions, alive_fn).length) return 'no session'
  if (await up()) return 'running'
  if (!take_start(starting, pid, alive_fn)) return 'starting'
  try {
    const child = launch()
    for (let count = 0; count < tries; count += 1) {
      if (await up()) {
        write_server(record, child.pid)
        return 'started'
      }
      await delay(wait_ms)
    }
    signal(child.pid, 'SIGTERM')
    return 'failed'
  } finally {
    drop_start(starting, pid)
  }
}

/** Stop the server this harness started once no session is open. */
export const close_server = async ({
  sessions,
  record,
  alive_fn = alive,
  stop = (/** @type {number} */ pid) => signal(pid, 'SIGTERM')
}) => {
  if (live_sessions(sessions, alive_fn).length) return 'still open'
  const pid = read_server(record, alive_fn)
  rm_sync(record, { force: true })
  if (!pid) return 'not running'
  stop(pid)
  return 'stopped'
}

/** Wire the lifecycle to pi. A session reload keeps the claim it already holds. */
export const local_sync = (
  /** @type {ExtensionAPI} */ pi,
  {
    pid = process.pid,
    paths = {
      sessions: join(state_dir, 'sessions'),
      record: join(state_dir, 'server.json'),
      starting: join(state_dir, 'starting')
    },
    up = local_up,
    launch = start_plan,
    stop = (/** @type {number} */ server_pid) => signal(server_pid, 'SIGTERM'),
    alive_fn = alive,
    tries = READY_TRIES,
    wait_ms = READY_MS
  } = {}
) => {
  pi.on('session_start', async () => {
    claim_session(pid, paths.sessions)
    await ensure_server({
      ...paths,
      pid,
      up,
      launch,
      alive_fn,
      tries,
      wait_ms
    })
  })
  pi.on('session_shutdown', async event => {
    if (event?.reason && event.reason !== 'quit') return
    release_session(pid, paths.sessions)
    await close_server({ ...paths, alive_fn, stop })
  })
}

export default (/** @type {ExtensionAPI} */ pi) => local_sync(pi)
