import { client, SYNC_URL } from "../../sync/src/client.js"
import { token_source } from "../../sync/src/login.js"
import { CapabilityError, file_capabilities } from "./files.js"

export const USAGE = `usage: brayness files sync <local-folder> <can://~/folder/> [--json]
       brayness files cat <can://~/file> [--json]

Uses the same sign-in as brayness-store. File sync is two-way.
`

function parse(args) {
  const words = args.filter((arg) => arg !== "--json")
  if (!words.length || (words.length === 1 && ["--help", "-h"].includes(words[0]))) return { command: "help" }
  if (words[0] === "files" && words[1] === "sync" && words.length === 4) return { command: "files.sync", local: words[2], remote: words[3] }
  if (words[0] === "files" && words[1] === "cat" && words.length === 3) return { command: "files.cat", path: words[2] }
  throw new CapabilityError("usage", USAGE.trimEnd())
}

function sync_text(report) {
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
export async function run(args, {
  get_token = token_source(),
  service_url = SYNC_URL,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const json = args.includes("--json")
  let command
  try {
    const request = parse(args)
    command = request.command
    if (command === "help") {
      stdout.write(json ? JSON.stringify({ ok: true, command, result: { usage: USAGE } }) + "\n" : USAGE)
      return 0
    }
    const token = await get_token()
    if (!token) throw new CapabilityError("not_signed_in", "not signed in; run brayness-store login")
    const files = file_capabilities({ store: client({ url: service_url, token }) })
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
