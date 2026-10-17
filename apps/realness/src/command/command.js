import { client, state_dir, SYNC_URL } from '#root/src/files/client.js'
import { is_actor } from '#root/src/harness/settings.js'
import { token_source } from '#root/src/sign-on/node/login.js'
import { CapabilityError, file_capabilities } from './files.js'
import { run_harness } from './harness-command.js'
import { run_store } from './store-command.js'
import { run_example } from './example-command.js'
import { run_frontend } from './frontend-command.js'
import { run_control } from './control-command.js'
import { run_task } from './task-command.js'
import { actor_client, actor_url } from '#root/src/harness/actor.js'
import { prepare_actor_state } from '#root/src/harness/state.js'
import { fetch_skipped } from '#root/src/harness/light.js'
import { fold_conflicts } from '#root/src/harness/fold.js'
import { find_root, use_harness_state } from '#root/src/harness/harness.js'
import { answer as git_answer } from '#root/src/harness/git-credential.js'
import { MS_PER_MINUTE, MS_PER_SECOND } from '#root/lib/units.js'
/* eslint-disable no-await-in-loop -- reads one file at a time to bound open files */

const FILES_SYNC_WORDS = 4

const USAGE = `usage: realness sync [--deletes] [plan ...]
       realness turn-start --session <file>
       realness turn-end --session <file> --turn <n>
       realness login|logout|whoami|ls|cat|cp|rm ...
       realness frontend build|deploy [--env development|production] [--dry-run]
       realness example static|app <destination>
       realness fold [--dry-run]       (merge .conflict session copies into their originals)
       realness fetch <harness-path>   (light VM: pull a file left in storage)
       realness git-credential get     (VM: git's helper for GitHub repos)
       realness task <plan> [--start]  (what a task on a plan may touch; start its VM)
       realness watch [--interval <seconds>] [--person +1...]...
       realness <local|development|production> <command> [options]
       realness <local|development|production> --help
       realness store sync <local-folder> <can://~/folder/> [--deletes]
       realness files sync <local-folder> <can://~/folder/> [--json]
       realness files cat <can://~/file> [--json]

Desktop uses sign-in; actors use their host-issued, path-limited passes.
File sync is two-way. realness-store remains a compatibility alias.
`

const parse = args => {
  const words = args.filter(arg => arg !== '--json')
  if (
    !words.length ||
    (words.length === 1 && ['--help', '-h'].includes(words[0]))
  )
    return { command: 'help' }
  if (
    words[0] === 'files' &&
    words[1] === 'sync' &&
    words.length === FILES_SYNC_WORDS
  )
    return { command: 'files.sync', local: words[2], remote: words[3] }
  if (words[0] === 'files' && words[1] === 'cat' && words.length === 3)
    return { command: 'files.cat', path: words[2] }
  throw new CapabilityError('usage', USAGE.trimEnd())
}

const sync_text = report => {
  const lines = []
  for (const [kind, names] of Object.entries(report)) {
    if (!Array.isArray(names) || !names.length) continue
    lines.push(`${kind}: ${names.length}`)
    if (['conflicts', 'held', 'kept_both', 'too_big'].includes(kind))
      for (const name of names) lines.push(`  ${name}`)
  }
  return lines.length ? `${lines.join('\n')}\n` : 'Nothing to sync.\n'
}

/**
 * CLI adapter over the shared capabilities. JSON is one result on stdout.
 * Errors have a nonzero exit status; partial sync reports are preserved.
 */
/** When this machine last synced each folder, from the local sync records. */
export const sync_records = async state => {
  const { readdir: list, readFile: read } = await import('node:fs/promises')
  const { join: join_path } = await import('node:path')
  const folder = join_path(state ?? state_dir(), 'sync')
  const names = await list(folder).catch(() => [])
  const records = {}
  for (const name of names.filter(file => file.endsWith('.json'))) {
    const saved = JSON.parse(
      await read(join_path(folder, name), 'utf8').catch(() => '{}')
    )
    const { remote } = saved
    if (!remote || remote.includes('/artifacts/')) continue
    const key = `can://~/${remote.replace(/^people\/\+\d+\//, '')}`
    const at = saved.walked_at ?? null
    if (!records[key] || (at && at > (records[key].at ?? '')))
      records[key] = { at }
  }
  return records
}

const read_stdin = async (stream = process.stdin) => {
  let text = ''
  for await (const chunk of stream) text += chunk
  return text
}

/** The store a files command talks to: an actor pass, or the signed-in keychain. */
const open_store = async (
  args,
  { actor, get_token, issue, root, service_url, state }
) => {
  if (actor) {
    const home = root ?? '/realness'
    const actor_state = await prepare_actor_state(home, { state })
    const { store } = await actor_client({
      url: service_url ?? (await actor_url(home, actor_state)),
      state: actor_state,
      issue
    })
    return store
  }
  const token = await get_token()
  if (!token)
    throw new CapabilityError(
      'not_signed_in',
      'not signed in; run realness login'
    )
  return client({
    url: service_url ?? SYNC_URL,
    token,
    state: state ?? (root ? use_harness_state(root) : undefined)
  })
}

/** Run a `files` subcommand and print its result. */
const run_files_command = async (
  args,
  { command, json, stdout, store, request }
) => {
  const files = file_capabilities({ store })
  const result =
    command === 'files.sync'
      ? await files.sync(request)
      : await files.read(request)
  if (json) stdout.write(`${JSON.stringify({ ok: true, command, result })}\n`)
  else
    stdout.write(
      command === 'files.sync'
        ? sync_text(result)
        : Buffer.from(result.content, result.encoding)
    )
  return 0
}

/** Print a failed run, JSON or plain. */
const report_failure = (error, { command, json, stderr, stdout }) => {
  const failure = {
    code: error.code ?? (error.status ? 'service_error' : 'capability_error'),
    message: error.message,
    ...(error.status && { status: error.status })
  }
  if (json)
    stdout.write(
      `${JSON.stringify({
        ok: false,
        command,
        result: error.result,
        error: failure
      })}\n`
    )
  else {
    if (error.result) stdout.write(sync_text(error.result))
    stderr.write(`realness: ${failure.message}\n`)
  }
  return 1
}

/** Merge `.conflict` session copies on the desktop harness. */
const run_fold = async (
  args,
  { actor, get_token, json, root, service_url, state, stdout }
) => {
  if (actor)
    throw new CapabilityError(
      'usage',
      'realness fold runs on the desktop harness'
    )
  const home = root ?? find_root()
  const sync_state = state ?? use_harness_state(home)
  const token = await get_token()
  if (!token) throw new Error('not signed in; run realness login')
  const result = await fold_conflicts({
    root: home,
    state: sync_state,
    store: client({ url: service_url ?? SYNC_URL, token }),
    dry_run: args.includes('--dry-run')
  })
  if (json)
    stdout.write(`${JSON.stringify({ ok: true, command: 'fold', result })}\n`)
  else {
    stdout.write(
      `${args.includes('--dry-run') ? 'would fold' : 'folded'} ${result.folded.length} session copies; left ${result.left.length}\n`
    )
    for (const name of result.left) stdout.write(`  left: ${name}\n`)
  }
  return 0
}

/** Pull a file the light VM left in storage. */
const run_fetch = async (
  args,
  { actor, issue, json, root, service_url, state, stdout }
) => {
  const path = args.slice(1).find(arg => arg !== '--json')
  if (!actor)
    throw new CapabilityError(
      'usage',
      'realness fetch runs on a light VM; this harness holds every file'
    )
  if (!path)
    throw new CapabilityError('usage', 'usage: realness fetch <harness-path>')
  const home = root ?? '/realness'
  const actor_state = await prepare_actor_state(home, { state })
  const { store } = await actor_client({
    url: service_url ?? (await actor_url(home, actor_state)),
    issue
  })
  const result = await fetch_skipped({
    root: home,
    state: actor_state,
    store,
    path: path.replace(/^\/realness\//, '').replace(/^\.\//, '')
  })
  stdout.write(
    json
      ? `${JSON.stringify({ ok: true, command: 'fetch', result })}\n`
      : `${result.fetched ? 'fetched' : 'already here'}: ${result.path}\n`
  )
  return 0
}

/** Git's credential helper on a VM. */
const run_git_credential = async (
  args,
  { actor, issue, root, service_url, state, stdin, stdout }
) => {
  if (!actor)
    throw new CapabilityError('usage', 'realness git-credential runs on a VM')
  const home = root ?? '/realness'
  const actor_state = await prepare_actor_state(home, { state })
  const text = await read_stdin(stdin)
  const [, operation] = args
  if (operation !== 'get') return 0
  const { store } = await actor_client({
    url: service_url ?? (await actor_url(home, actor_state)),
    issue
  })
  stdout.write(await git_answer(operation, text, store))
  return 0
}

/** Watch halo health on the desktop harness until interrupted. */
const run_watch_command = async (
  args,
  { actor, get_token, json, service_url, state, stdin, stdout }
) => {
  if (actor)
    throw new CapabilityError(
      'usage',
      'realness watch runs on the desktop harness'
    )
  const token = await get_token()
  if (!token)
    throw new CapabilityError(
      'not_signed_in',
      'not signed in; run realness login'
    )
  let interval_ms = MS_PER_MINUTE
  const named = []
  for (let at = 1; at < args.length; at++)
    if (args[at] === '--interval')
      interval_ms = Math.max(
        MS_PER_SECOND,
        Number(args[++at]) * MS_PER_SECOND || MS_PER_MINUTE
      )
    else if (args[at] === '--person') named.push(args[++at])

  const { watch } = await import('./watch-loop.js')
  const { ledger } = await import('./watch-ledger.js')
  const { cloud_sources } = await import('./watch-cloud.js')
  const { sync_traffic_cache } =
    await import('#root/tools/ops/hosting-traffic.js')
  const store = client({ url: service_url ?? SYNC_URL, token })
  const controller = new AbortController()
  process.once('SIGINT', () => controller.abort())
  process.once('SIGTERM', () => controller.abort())
  const records = await sync_records(state)
  const run_watch = () =>
    watch({
      store,
      token,
      ledger: ledger(store),
      named,
      records,
      service: service_url ?? SYNC_URL,
      cloud: cloud_sources({ store, sync: sync_traffic_cache }),
      interval_ms,
      signal: controller.signal,
      stdout,
      stdin
    })
  if (json)
    stdout.write(
      `${JSON.stringify({ ok: true, command: 'watch', result: await run_watch() })}\n`
    )
  else await run_watch()
  return 0
}

/**
 * The product entry point: every realness subcommand starts here.
 * @param {string[]} args
 * @param {object} [options]
 * @param {() => Promise<string | null>} [options.get_token]
 * @param {string} [options.service_url]
 * @param {boolean} [options.actor]
 * @param {string} [options.root]
 * @param {string} [options.state]
 * @param {(destination: string) => Promise<unknown>} [options.export_static]
 * @param {() => Promise<string>} [options.issue]
 * @param {NodeJS.WriteStream & { fd: 1 }} [options.stdout]
 * @param {NodeJS.WriteStream & { fd: 2 }} [options.stderr]
 * @param {NodeJS.ReadStream & { fd: 0 }} [options.stdin]
 */
export const run = async (
  args,
  {
    get_token = token_source(),
    service_url,
    actor = is_actor(),
    root: root_option,
    state: state_option,
    export_static,
    issue,
    stdout = process.stdout,
    stderr = process.stderr,
    stdin = process.stdin
  } = {}
) => {
  const root = root_option
  const state = state_option
  const json = args.includes('--json')
  let command
  try {
    const options = {
      get_token,
      service_url,
      actor,
      root,
      state,
      export_static,
      issue,
      stdout,
      stderr
    }
    if (['local', 'development', 'production'].includes(args[0]))
      return await run_control(args, { actor, stdin, stdout, stderr })
    if (args[0] === 'frontend')
      return await run_frontend(args.slice(1), { stdout, stderr, actor })
    if (args[0] === 'example') return await run_example(args.slice(1), options)
    if (args[0] === 'task') {
      command = 'task'
      return await run_task(args.slice(1), {
        stdout,
        stderr,
        ...(root && { root })
      })
    }
    if (['sync', 'turn-start', 'turn-end'].includes(args[0])) {
      ;[command] = args
      return await run_harness(args, options)
    }
    ;[command] = args
    const common = { ...options, json, stdin }
    if (args[0] === 'fold') return await run_fold(args, common)
    if (args[0] === 'fetch') return await run_fetch(args, common)
    if (args[0] === 'git-credential')
      return await run_git_credential(args, common)
    if (args[0] === 'watch') return await run_watch_command(args, common)
    if (args[0] === 'store') return await run_store(args.slice(1), options)
    if (
      ['login', 'logout', 'whoami', 'ls', 'cat', 'cp', 'rm'].includes(args[0])
    )
      return await run_store(args, options)
    const request = parse(args)
    ;({ command } = request)
    if (command === 'help') {
      stdout.write(
        json
          ? `${JSON.stringify({
              ok: true,
              command,
              result: { usage: USAGE }
            })}\n`
          : USAGE
      )
      return 0
    }
    const store = await open_store(args, {
      actor,
      get_token,
      issue,
      root,
      service_url,
      state
    })
    return await run_files_command(args, {
      command,
      json,
      request,
      stdout,
      store
    })
  } catch (error) {
    return report_failure(error, { command, json, stderr, stdout })
  }
}
