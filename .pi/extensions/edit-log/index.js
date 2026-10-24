/**
 * Edit Log Extension
 *
 * After every successful `edit` or `write`, logs the file's path and
 * fingerprint with the session and turn that made it. Sync uses the log to
 * decide: changes the log explains may delete or replay; the rest keep both.
 *
 * Formatters (the auto-fix extension) rewrite files once the agent stops, so every
 * touched path is fingerprinted again once it holds still, as tool `settle`.
 *
 * Each agent run is bracketed by `realness turn-start` and `turn-end`, which
 * log whatever changed in synced folders during it (bash too). Desktop turns
 * upload only while `npm run local` is up, to its sync; actors always sync.
 */
/** @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI */
import { execFile, spawn } from 'node:child_process'
import { mkdirSync, openSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { openLog, record, sha, stateDir, logPath } from './log.js'
import { is_actor, harness_root } from '../../bin/lib/harness-settings.js'
import { product_entry } from '../../bin/lib/product.js'

const in_actor = is_actor
/** Desktop runs the repo's command; an actor runs its `realness` wrapper. */
/**
 * @param {string[]} args
 * @returns {[string, string[]]}
 */
const sync_command = (args) =>
  !in_actor()
    ? [process.execPath, [product_entry('command'), ...args]]
    : ['realness', args]

/**
 * @param {string} cwd
 * @returns {string | undefined}
 */
const harness = harness_root
/** @param {ExtensionAPI} pi */
const editLog = (pi) => {
  /** @type {ReturnType<typeof openLog> | undefined} */
  let db
  let turn = 0
  /** @type {Map<string, { session: string; turn: number; sha: string | null; }>} */
  const touched = new Map()
  /** @param {string} path */
  const fingerprint = (path) => {
    try {
      return sha(readFileSync(path))
    } catch {
      return null
    }
  }
  /**
   * @param {{ cwd: string; ui: { notify: (m: string, l: "warning") => void; }; }} ctx
   * @param {Parameters<typeof record>[1]} edit
   */
  const log = (ctx, edit) => {
    try {
      db ??= openLog(logPath(ctx.cwd))
      record(db, edit)
    } catch (error) {
      ctx.ui.notify(`edit-log: ${/** @type {Error} */ (error).message}`, 'warning')
    }
  }
  pi.on('turn_start', (event) => {
    turn = event.turnIndex
  })
  pi.on('tool_result', (event, ctx) => {
    if (event.isError || (event.toolName !== 'edit' && event.toolName !== 'write')) return
    const given = /** @type {{ path?: unknown; }} */ (event.input).path
    if (typeof given !== 'string') return
    const path = resolve(ctx.cwd, given.replace(/^@/, ''))
    const session = ctx.sessionManager.getSessionFile() ?? 'ephemeral'
    const now = fingerprint(path)
    touched.set(path, {
      session,
      turn,
      sha: now,
    })
    log(ctx, {
      path,
      sha: now,
      session,
      turn,
      tool: event.toolName,
      tool_call: event.toolCallId,
      ts: new Date().toISOString(),
    })
  })
  /** @typedef {Parameters<typeof log>[0]} Ctx */
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let waiting
  /** @type {{ root: string; session: string; } | undefined} */
  let open

  /** Log the finished turn and sync, detached so pi never waits on the network. */
  const endTurn = () => {
    if (!open) return
    const { root, session } = open
    open = undefined
    mkdirSync(stateDir(root), {
      recursive: true,
    })
    const out = openSync(join(stateDir(root), 'sync.log'), 'a')
    const [command, args] = sync_command([
      'turn-end',
      '--session',
      session,
      '--turn',
      String(turn),
    ])
    spawn(command, args, {
      cwd: root,
      detached: true,
      stdio: ['ignore', out, out],
    }).unref()
  }

  /** Fingerprint touched files again; anything a formatter changed is logged as `settle`. */
  /** @param {Ctx} ctx */
  const settle = (ctx) => {
    clearTimeout(waiting)
    waiting = undefined
    for (const [path, was] of touched) {
      const now = fingerprint(path)
      if (now === was.sha) continue
      log(ctx, {
        path,
        sha: now,
        session: was.session,
        turn: was.turn,
        tool: 'settle',
        tool_call: '',
        ts: new Date().toISOString(),
      })
    }
    touched.clear()
    endTurn()
  }
  const stamp = () => [...touched.keys()].map((path) => fingerprint(path)).join()
  pi.on('agent_end', (_event, ctx) => {
    if (!touched.size) return settle(ctx)
    let last = stamp()
    let quiet = 0
    const started = Date.now()
    const check = () => {
      const now = stamp()
      quiet = now === last ? quiet + 1 : 0
      last = now
      if (quiet >= 2 || Date.now() - started > 30_000) settle(ctx)
      else waiting = setTimeout(check, 1000)
    }
    waiting = setTimeout(check, 1000)
  })
  pi.on('agent_start', async (_event, ctx) => {
    settle(ctx)
    const root = harness(ctx.cwd)
    if (!root) return
    const session = ctx.sessionManager.getSessionFile() ?? 'ephemeral'
    try {
      const [command, args] = sync_command(['turn-start', '--session', session])
      await promisify(execFile)(command, args, {
        cwd: root,
      })
      open = {
        root,
        session,
      }
    } catch (error) {
      ctx.ui.notify(
        `edit-log: turn-start failed: ${/** @type {Error} */ (error).message}`,
        'warning',
      )
    }
  })
  pi.on('session_shutdown', (_event, ctx) => {
    settle(ctx)
    db?.close()
    db = undefined
  })
}
export default editLog
