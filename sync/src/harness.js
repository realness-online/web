/**
 * What `brayness sync` carries: Pi session history, plus the folders each
 * plan names under a `## Syncs` heading, relative to the harness root.
 *
 *   ## Syncs
 *
 *   - `work/thoughts`
 *   - artifacts/posters
 *
 * Paths inside a git repo are refused for now; git carries repos.
 */
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { readFile, readdir } from "node:fs/promises"
import { dirname, isAbsolute, join, normalize, resolve } from "node:path"
import { promisify } from "node:util"
import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { apply, load_calls } from "./replay.js"
import { skipped } from "./skip.js"

const SESSIONS = ".pi/agent/sessions"
/** Edits a later actor must replay: harness path to base, target, and calls. */
const DEFERRED = "can://~/.pi/agent/deferred.json"
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex")

const run = promisify(execFile)

/** The harness root: BRAYNESS_ROOT, else the nearest folder above holding `plans/`. */
export function find_root(start = process.cwd(), env = process.env) {
  if (env.BRAYNESS_ROOT) return resolve(env.BRAYNESS_ROOT)
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "plans"))) return dir
    if (dirname(dir) === dir) throw new Error("no harness here: no plans/ above, and BRAYNESS_ROOT is unset")
  }
}

/** List items under `## Syncs`, until the next heading of that level or higher. */
export function syncs_of(markdown) {
  const paths = []
  let inside = false
  for (const line of markdown.split("\n")) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(line)
    if (heading) inside = heading[2].trim().toLowerCase() === "syncs"
    else if (inside) {
      const item = /^\s*[-*]\s+`?([^`]+?)`?\s*$/.exec(line)
      if (item) paths.push(item[1])
    }
  }
  return paths
}

/** Why a path cannot sync, or null. */
export function refused(path) {
  if (isAbsolute(path)) return "absolute"
  const clean = normalize(path).replace(/\/$/, "")
  if (clean === "." || clean.startsWith("..")) return "outside the harness"
  if (skipped(clean)) return "never syncs"
  return null
}

/** The repo a path sits in, checked from its nearest existing folder. */
export async function repo_of(path) {
  let dir = resolve(path)
  while (!existsSync(dir)) dir = dirname(dir)
  try {
    const { stdout } = await run("git", ["-C", dir, "rev-parse", "--show-toplevel"])
    return stdout.trim()
  } catch {
    return null
  }
}

/** Every plan's Syncs paths, named plans only when given. */
export async function plan_syncs(root, names = []) {
  const files = names.length
    ? names.map((name) => (name.endsWith(".md") ? name : `${name}.md`))
    : (await readdir(join(root, "plans"))).filter((name) => name.endsWith(".md"))
  const found = new Map()
  for (const file of files) {
    const text = await readFile(join(root, "plans", file), "utf8")
    for (const path of syncs_of(text)) {
      const key = normalize(path).replace(/\/$/, "")
      if (!found.has(key)) found.set(key, file)
    }
  }
  // Conversation history belongs to the harness, not an individual plan.
  found.set(".pi/agent/sessions", "harness")
  return found
}

/**
 * Sync every plan's paths to `can://~/<path>/`. Refused paths are named, never
 * synced; the rest still run.
 */
export async function sync_harness({ root, store, plans = [], deletes, defer_edits = false }) {
  const synced = {}
  const refusals = {}
  const paths = await plan_syncs(root, plans)
  // The session bytes must reach storage before any file relies on their edits.
  for (const [path, plan] of [...paths].sort(([a], [b]) => Number(b === ".pi/agent/sessions") - Number(a === ".pi/agent/sessions"))) {
    const local = join(root, path)
    const reason = refused(path) ?? ((await repo_of(local)) ? "inside a git repo" : null)
    if (reason) refusals[path] = `${reason} (${plan})`
    else synced[path] = await store.sync(local, `can://~/${path}/`, { deletes, defer_edits: defer_edits && path !== SESSIONS, sessions: join(root, SESSIONS) })
  }
  const pending = await read_deferred(store)
  const applied = await apply_deferred(root, pending)
  let changed = false
  for (const [path, report] of Object.entries(synced)) {
    if (path === SESSIONS) continue
    // Only real bytes in storage retire a pending edit.
    const settled = ["pushed", "adopted", "replayed", "kept_both", "deleted", "removed"].flatMap((kind) => report[kind])
    for (const name of settled) {
      if (pending[`${path}/${name}`]) {
        delete pending[`${path}/${name}`]
        changed = true
      }
    }
    for (const name of report.deferred) {
      if (report.replay[name]) {
        pending[`${path}/${name}`] = report.replay[name]
        changed = true
      }
    }
  }
  if (changed && store.put) await store.put(DEFERRED, `${JSON.stringify(pending, null, 2)}\n`)
  return { synced, refused: refusals, applied }
}

async function read_deferred(store) {
  if (!store.cat) return {}
  try {
    return JSON.parse((await store.cat(DEFERRED)).toString())
  } catch (error) {
    if (error.status === 404) return {}
    throw error
  }
}

/**
 * Rebuild deferred files from saved history: only where the local bytes are
 * exactly the saved base and the replay yields exactly the recorded target.
 */
export async function apply_deferred(root, pending) {
  const applied = []
  for (const [path, { base_sha, target_sha, calls }] of Object.entries(pending)) {
    if (refused(path)) continue
    const file = join(root, path)
    const bytes = await readFile(file).catch(() => null)
    if (!bytes || sha(bytes) !== base_sha) continue
    const rows = calls.map(({ session, tool_call }) => ({ session: join(root, SESSIONS, session), tool_call }))
    if (rows.some((row) => !row.session.startsWith(join(root, SESSIONS) + "/"))) continue
    const replayed = apply(bytes.toString("utf8"), await load_calls(rows))
    if (replayed === null || sha(Buffer.from(replayed)) !== target_sha) continue
    await writeFile(file, replayed)
    applied.push(path)
  }
  return applied.sort()
}
