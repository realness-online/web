#!/usr/bin/env node
/**
 * The harness command.
 *
 *   brayness sync            the whole harness, minus .ignore; plus
 *                            each plan's Syncs folders at their old places
 *   brayness sync brayness   Pi session history and the configured brayness.md's folders
 *   brayness sync --deletes  also send deletes no session explains
 *   brayness turn-start --session <file>
 *   brayness turn-end   --session <file> --turn <n>   logs the turn, then syncs
 *
 * Local deletes no session explains are held and listed; remote deletes move
 * files to the Trash. The edit-log extension calls turn-start and turn-end.
 *
 * Sign in first with `brayness-store login`. BRAYNESS_ROOT picks the harness;
 * otherwise the nearest harness package, ignore file, Pi config, or vault/plans/.
 */
import { basename } from "node:path"
import { client, state_dir, SYNC_URL, SyncError } from "../src/client.js"
import { find_root, sync_harness } from "../src/harness.js"
import { token_source } from "../src/login.js"
import { turn_end, turn_start } from "../src/turns.js"

const [command, ...rest] = process.argv.slice(2)
const option = (name) => {
  const at = rest.indexOf(`--${name}`)
  return at === -1 ? undefined : rest.splice(at, 2)[1]
}
const deletes = rest.includes("--deletes") ? "all" : "explained"
const session = option("session")
const turn = Number(option("turn") ?? 0)
const args = rest.filter((arg) => arg !== "--deletes")

const who = (ours) => (ours ? ` (ours: turn ${ours.turn} of ${basename(ours.session)})` : "")

const sync = async ({ defer_edits = false } = {}) => {
  const token = await token_source()()
  if (!token) throw new Error("not signed in; run brayness-store login")
  const { harness, synced, refused } = await sync_harness({ root: find_root(), store: client({ url: SYNC_URL, token }), plans: args, deletes, defer_edits })
  const reports = { ...(harness && { "harness history": harness.sessions, harness: harness.files }), ...Object.fromEntries(Object.entries(synced).map(([path, report]) => [harness ? `old place ${path}` : path, report])) }
  for (const name of harness?.files.too_big ?? []) console.log(`  too big, left home: ${name}`)
  for (const [path, report] of Object.entries(reports)) {
    const moved = Object.entries(report).filter(([kind, names]) => Array.isArray(names) && kind !== "unchanged" && names.length)
    console.log(`${path}: ${moved.map(([kind, names]) => `${kind} ${names.length}`).join(", ") || "unchanged"}`)
    for (const kind of ["kept_both", "held", "conflicts"])
      for (const name of report[kind]) console.log(`  ${kind}: ${name}${who(report.sessions[name])}`)
    if (report.conflicts.length) process.exitCode = 1
  }
  for (const [path, reason] of Object.entries(refused)) console.error(`refused ${path}: ${reason}`)
  if (Object.keys(refused).length) process.exitCode = 1
  if (!Object.keys(synced).length && !Object.keys(refused).length) console.log("Nothing to sync.")
}

const commands = {
  sync,
  "turn-start": () => turn_start({ root: find_root(), state: state_dir(), session }),
  async "turn-end"() {
    const logged = await turn_end({ root: find_root(), state: state_dir(), session, turn })
    if (logged.length) console.log(`turn ${turn}: ${logged.length} change(s) logged`)
    await sync({ defer_edits: true })
  },
}

if (!commands[command] || (command.startsWith("turn") && !session)) {
  console.error("usage: brayness sync [--deletes] [plan ...] | turn-start --session <f> | turn-end --session <f> --turn <n>")
  process.exit(2)
}
try {
  await commands[command]()
} catch (error) {
  console.error(error instanceof SyncError ? `${error.message}` : error.message)
  process.exit(1)
}
