import { client, SYNC_URL } from "#root/lib/files/src/client.js"
import { token_source } from "#root/lib/sign-on/src/node/login.js"
import { CapabilityError, file_capabilities } from "./files.js"
import { run_harness } from "./harness-command.js"
import { run_store } from "./store-command.js"
import { run_example } from "./example-command.js"
import { actor_client, actor_url } from "#root/lib/harness/src/actor.js"
import { prepare_actor_state } from "#root/lib/harness/src/state.js"

export const USAGE = `usage: brayness sync [--deletes] [plan ...]
       brayness turn-start --session <file>
       brayness turn-end --session <file> --turn <n>
       brayness login|logout|whoami|ls|cat|cp|rm ...
       brayness example static|app <destination>
       brayness store sync <local-folder> <can://~/folder/> [--deletes]
       brayness files sync <local-folder> <can://~/folder/> [--json]
       brayness files cat <can://~/file> [--json]

Desktop uses sign-in; actors use their host-issued, path-limited passes.
File sync is two-way. brayness-store remains a compatibility alias.
`

const parse = (args) => {
  const words = args.filter((arg) => arg !== "--json")
  if (!words.length || (words.length === 1 && ["--help", "-h"].includes(words[0]))) return { command: "help" }
  if (words[0] === "files" && words[1] === "sync" && words.length === 4) return { command: "files.sync", local: words[2], remote: words[3] }
  if (words[0] === "files" && words[1] === "cat" && words.length === 3) return { command: "files.cat", path: words[2] }
  throw new CapabilityError("usage", USAGE.trimEnd())
}

const sync_text = (report) => {
  const lines = []
  for (const [kind, names] of Object.entries(report)) {
    if (!Array.isArray(names) || !names.length) continue
    lines.push(`${kind}: ${names.length}`)
    if (["conflicts", "held", "kept_both", "too_big"].includes(kind)) {
      for (const name of names) lines.push(`  ${name}`)
    }
  }
  return lines.length ? lines.join("\n") + "\n" : "Nothing to sync.\n"
}

/**
 * CLI adapter over the shared capabilities. JSON is one result on stdout.
 * Errors have a nonzero exit status; partial sync reports are preserved.
 */
export const run = async (args, {
  get_token = token_source(),
  service_url,
  actor = process.env.BRAYNESS_ACTOR === '1' || process.env.PROFILE === 'actor',
  root, state, issue,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) => {
  const json = args.includes("--json")
  let command
  try {
    const options = { get_token, service_url, actor, root, state, issue, stdout, stderr }
    if (args[0] === 'example') return await run_example(args.slice(1), options)
    if (['sync', 'turn-start', 'turn-end'].includes(args[0])) {
      command = args[0]
      return await run_harness(args, options)
    }
    if (args[0] === 'store') return await run_store(args.slice(1), options)
    if (['login', 'logout', 'whoami', 'ls', 'cat', 'cp', 'rm'].includes(args[0])) return await run_store(args, options)
    const request = parse(args)
    command = request.command
    if (command === "help") {
      stdout.write(json ? JSON.stringify({ ok: true, command, result: { usage: USAGE } }) + "\n" : USAGE)
      return 0
    }
    let store
    if (actor) {
      root ??= process.env.BRAYNESS_ROOT ?? '/brayness'
      state = await prepare_actor_state(root, { state })
      process.env.BRAYNESS_STATE = state
      store = (await actor_client({ url: service_url ?? await actor_url(root, state), issue })).store
    } else {
      const token = await get_token()
      if (!token) throw new CapabilityError('not_signed_in', 'not signed in; run brayness login')
      store = client({ url: service_url ?? SYNC_URL, token })
    }
    const files = file_capabilities({ store })
    const result = command === "files.sync" ? await files.sync(request) : await files.read(request)
    if (json) stdout.write(JSON.stringify({ ok: true, command, result }) + "\n")
    else stdout.write(command === "files.sync" ? sync_text(result) : Buffer.from(result.content, result.encoding))
    return 0
  } catch (error) {
    const failure = {
      code: error.code ?? (error.status ? "service_error" : "capability_error"),
      message: error.message,
      ...(error.status && { status: error.status }),
    }
    if (json) stdout.write(JSON.stringify({ ok: false, command, result: error.result, error: failure }) + "\n")
    else {
      if (error.result) stdout.write(sync_text(error.result))
      stderr.write(`brayness: ${failure.message}\n`)
    }
    return 1
  }
}
