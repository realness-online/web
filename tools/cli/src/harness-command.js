import { basename, join } from 'node:path'
import { client, state_dir, SYNC_URL } from '#root/lib/files/src/client.js'
import { actor_url, sync_actor } from '#root/lib/harness/src/actor.js'
import { find_root, sync_harness, use_harness_state } from '#root/lib/harness/src/harness.js'
import { turn_end, turn_start } from '#root/lib/harness/src/turns.js'
import { token_source } from '#root/lib/sign-on/src/node/login.js'
import { prepare_actor_state } from '#root/lib/harness/src/state.js'

/** Run the same harness command on desktop and actors, with their own credentials. */
export const run_harness = async (args, {
  actor = false, root, state, get_token = token_source(), service_url,
  issue, stdout = process.stdout, stderr = process.stderr
} = {}) => {
  const [command, ...rest] = args
  const json = rest.includes('--json')
  const option = name => {
    const at = rest.indexOf(`--${name}`)
    return at === -1 ? undefined : rest.splice(at, 2)[1]
  }
  const session = option('session')
  const turn = Number(option('turn') ?? 0)
  if (command.startsWith('turn') && !session) {
    const message = 'turn commands need --session <file>'
    if (json) stdout.write(JSON.stringify({ ok: false, command, error: { code: 'usage', message } }) + '\n')
    else stderr.write(`brayness: ${message}\n`)
    return 2
  }
  root ??= actor ? process.env.BRAYNESS_ROOT ?? '/brayness' : find_root()
  if (actor) {
    state = await prepare_actor_state(root, { state })
    process.env.BRAYNESS_STATE = state
  } else {
    use_harness_state(root)
    state ??= state_dir()
  }
  if (command === 'turn-start') {
    await turn_start({ root, state, session })
    if (json) stdout.write(JSON.stringify({ ok: true, command, result: null }) + '\n')
    return 0
  }
  if (command === 'turn-end') {
    const logged = await turn_end({ root, state, session, turn })
    if (logged.length && !json && !actor) stdout.write(`turn ${turn}: ${logged.length} change(s) logged\n`)
  }
  if (actor) {
    const result = await sync_actor({ root, state, url: service_url ?? await actor_url(root, state), issue, defer_edits: command === 'turn-end' })
    stdout.write(JSON.stringify(json ? { ok: true, command, result } : result) + '\n')
    return 0
  }
  const token = await get_token()
  if (!token) throw new Error('not signed in; run brayness login')
  const result = await sync_harness({
    root, store: client({ url: service_url ?? SYNC_URL, token }),
    plans: rest.filter(arg => !['--deletes', '--json'].includes(arg)),
    deletes: rest.includes('--deletes') ? 'all' : 'explained', defer_edits: command === 'turn-end'
  })
  const { harness, synced, refused } = result
  const reports = { ...(harness && { 'harness history': harness.sessions, harness: harness.files }), ...Object.fromEntries(Object.entries(synced).map(([path, report]) => [harness ? `old place ${path}` : path, report])) }
  const failed = Object.values(reports).some(report => report.conflicts.length) || Object.keys(refused).length > 0
  if (json) {
    stdout.write(JSON.stringify({ ok: !failed, command, result }) + '\n')
    return failed ? 1 : 0
  }
  for (const name of harness?.files.too_big ?? []) stdout.write(`  too big, left home: ${name}\n`)
  for (const [path, report] of Object.entries(reports)) {
    const moved = Object.entries(report).filter(([kind, names]) => Array.isArray(names) && kind !== 'unchanged' && names.length)
    stdout.write(`${path}: ${moved.map(([kind, names]) => `${kind} ${names.length}`).join(', ') || 'unchanged'}\n`)
    for (const kind of ['kept_both', 'held', 'conflicts']) {
      for (const name of report[kind]) {
        const ours = report.sessions[name]
        stdout.write(`  ${kind}: ${name}${ours ? ` (ours: turn ${ours.turn} of ${basename(ours.session)})` : ''}\n`)
      }
    }
  }
  for (const [path, reason] of Object.entries(refused)) stderr.write(`refused ${path}: ${reason}\n`)
  if (!Object.keys(synced).length && !Object.keys(refused).length) stdout.write('Nothing to sync.\n')
  return failed ? 1 : 0
}
