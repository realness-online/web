#!/usr/bin/env node
/**
 * The harness command.
 *
 *   brayness sync            every plan's Syncs folders, both ways
 *   brayness sync brayness   only plans/brayness.md's
 *   brayness sync --deletes  also send deletes no session explains
 *
 * Local deletes no session explains are held and listed; remote deletes move
 * files to the Trash.
 *
 * Sign in first with `brayness-store login`. BRAYNESS_ROOT picks the harness;
 * otherwise the nearest folder above holding plans/.
 */
import { client, SYNC_URL, SyncError } from "../src/client.js"
import { find_root, sync_harness } from "../src/harness.js"
import { token_source } from "../src/login.js"

const [command, ...rest] = process.argv.slice(2)
const deletes = rest.includes("--deletes") ? "all" : "explained"
const args = rest.filter((arg) => arg !== "--deletes")

if (command !== "sync") {
  console.error("usage: brayness sync [--deletes] [plan ...]")
  process.exit(2)
}
try {
  const token = await token_source()()
  if (!token) throw new Error("not signed in; run brayness-store login")
  const { synced, refused } = await sync_harness({ root: find_root(), store: client({ url: SYNC_URL, token }), plans: args, deletes })
  for (const [path, report] of Object.entries(synced)) {
    const moved = Object.entries(report).filter(([kind, names]) => kind !== "unchanged" && names.length)
    console.log(`${path}: ${moved.map(([kind, names]) => `${kind} ${names.length}`).join(", ") || "unchanged"}`)
    for (const kind of ["kept_both", "held", "conflicts"]) for (const name of report[kind]) console.log(`  ${kind}: ${name}`)
    if (report.conflicts.length) process.exitCode = 1
  }
  for (const [path, reason] of Object.entries(refused)) console.error(`refused ${path}: ${reason}`)
  if (Object.keys(refused).length) process.exitCode = 1
  if (!Object.keys(synced).length && !Object.keys(refused).length) console.log("No plan lists a ## Syncs folder.")
} catch (error) {
  console.error(error instanceof SyncError ? `${error.message}` : error.message)
  process.exit(1)
}
