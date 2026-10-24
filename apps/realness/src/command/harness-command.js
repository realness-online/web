import { existsSync as exists_sync } from 'node:fs'
import { basename, join } from 'node:path'
import { client } from '#root/src/files/client.js'
import { sync_target } from '#root/src/files/target.js'
import { actor_url, sync_actor } from '#root/src/harness/actor.js'
import {
  find_root,
  sync_harness,
  use_harness_state
} from '#root/src/harness/harness.js'
import { turn_end, turn_start } from '#root/src/harness/turns.js'
import { prepare_actor_state } from '#root/src/harness/state.js'

export const SYNC_PAUSED = 'sync-paused'

const report_harness = (result, { command, json, stdout, stderr }) => {
  const { harness, synced, refused } = result
  const reports = {
    ...(harness && {
      'harness history': harness.sessions,
      harness: harness.files
    }),
    ...Object.fromEntries(
      Object.entries(synced).map(([path, report]) => [
        harness ? `old place ${path}` : path,
        report
      ])
    )
  }
  const failed =
    Object.values(reports).some(report => report.conflicts.length) ||
    Object.keys(refused).length > 0
  if (json) {
    stdout.write(`${JSON.stringify({ ok: !failed, command, result })}\n`)
    return failed ? 1 : 0
  }
  for (const name of harness?.files.too_big ?? [])
    stdout.write(`  too big, left home: ${name}\n`)
  for (const [path, report] of Object.entries(reports)) {
    const moved = Object.entries(report).filter(
      ([kind, names]) =>
        Array.isArray(names) && kind !== 'unchanged' && names.length
    )
    stdout.write(
      `${path}: ${moved.map(([kind, names]) => `${kind} ${names.length}`).join(', ') || 'unchanged'}\n`
    )
    for (const kind of ['kept_both', 'held', 'conflicts'])
      for (const name of report[kind]) {
        const ours = report.sessions[name]
        stdout.write(
          `  ${kind}: ${name}${ours ? ` (ours: turn ${ours.turn} of ${basename(ours.session)})` : ''}\n`
        )
      }
  }
  for (const [path, reason] of Object.entries(refused))
    stderr.write(`refused ${path}: ${reason}\n`)
  if (!Object.keys(synced).length && !Object.keys(refused).length)
    stdout.write('Nothing to sync.\n')
  return failed ? 1 : 0
}

/** @param {string[]} rest */
const harness_options = rest => {
  const option = name => {
    const at = rest.indexOf(`--${name}`)
    return at === -1 ? undefined : rest.splice(at, 2)[1]
  }
  const session = option('session')
  const turn = Number(option('turn') ?? 0)
  return { session, turn }
}

/**
 * @returns {Promise<number | null>} Exit code when turn-end stopped early, else null.
 */
const end_turn = async ({
  actor,
  command,
  local,
  json,
  root,
  session,
  state,
  stdout,
  turn
}) => {
  if (command !== 'turn-end') return null
  const logged = await turn_end({ root, state, session, turn })
  if (logged.length && !json && !actor)
    stdout.write(`turn ${turn}: ${logged.length} change(s) logged\n`)
  if (!actor && !local) {
    if (json)
      stdout.write(
        `${JSON.stringify({
          ok: true,
          command,
          result: { logged: logged.length, synced: false }
        })}\n`
      )
    return 0
  }
  return null
}

/**
 * Run the same harness command on desktop and actors, with their own credentials.
 * @param {string[]} args
 * @param {object} [options]
 * @param {boolean} [options.actor]
 * @param {string} [options.root]
 * @param {string} [options.state]
 * @param {() => Promise<{ local: boolean, url: string, get_token: () => Promise<string | null> }>} [options.target] Where desktop sync goes: the local stack when it is up
 * @param {string} [options.service_url]
 * @param {() => Promise<string>} [options.issue]
 * @param {NodeJS.WriteStream & { fd: 1 }} [options.stdout]
 * @param {NodeJS.WriteStream & { fd: 2 }} [options.stderr]
 */
export const run_harness = async (
  args,
  {
    actor = false,
    root: root_option,
    state: state_option,
    target = sync_target,
    service_url,
    issue,
    stdout = process.stdout,
    stderr = process.stderr
  } = {}
) => {
  let root = root_option
  let state = state_option
  const [command, ...rest] = args
  const json = rest.includes('--json')
  const { session, turn } = harness_options(rest)
  if (command.startsWith('turn') && !session) {
    const message = 'turn commands need --session <file>'
    if (json)
      stdout.write(
        `${JSON.stringify({
          ok: false,
          command,
          error: { code: 'usage', message }
        })}\n`
      )
    else stderr.write(`realness: ${message}\n`)
    return 2
  }
  root ??= actor ? '/realness' : find_root()
  if (actor) state = await prepare_actor_state(root, { state })
  else state ??= use_harness_state(root)

  if (command === 'turn-start') {
    await turn_start({ root, state, session })
    if (json)
      stdout.write(`${JSON.stringify({ ok: true, command, result: null })}\n`)
    return 0
  }
  const where = actor ? null : await target()
  const early = await end_turn({
    actor,
    command,
    local: where?.local,
    json,
    root,
    session,
    state,
    stdout,
    turn
  })
  if (early !== null) return early
  if (exists_sync(join(state, SYNC_PAUSED))) {
    const message = `sync paused: remove ${join(state, SYNC_PAUSED)} to resume`
    stdout.write(
      json
        ? `${JSON.stringify({ ok: true, command, result: { paused: true } })}\n`
        : `${message}\n`
    )
    return 0
  }
  if (actor) {
    const result = await sync_actor({
      root,
      state,
      url: service_url ?? (await actor_url(root, state)),
      issue,
      defer_edits: command === 'turn-end'
    })
    stdout.write(
      `${JSON.stringify(json ? { ok: true, command, result } : result)}\n`
    )
    return 0
  }
  const token = await where.get_token()
  if (!token) throw new Error('not signed in; run realness login')
  const result = await sync_harness({
    root,
    state,
    store: client({ url: service_url ?? where.url, token, state }),
    plans: rest.filter(arg => !['--deletes', '--json'].includes(arg)),
    deletes: rest.includes('--deletes') ? 'all' : 'explained',
    defer_edits: command === 'turn-end'
  })
  return report_harness(result, { command, json, stdout, stderr })
}
