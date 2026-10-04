/**
 * What `brayness sync` carries: the whole harness, at `can://~/harness/`,
 * minus fixed ignores (skip.js), the person's `.ignore`, git repos,
 * and files over the upload limit. Pi session history goes first. Without a
 * `.ignore`, only the plans' Syncs paths and history sync, as before.
 *
 * Until VM recovery reads `harness/`, each plan's `## Syncs` paths also keep
 * their old places at `can://~/<path>/` (sync_listed).
 */
import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { readFile, readdir, stat } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, normalize, resolve } from "node:path"
import { promisify } from "node:util"
import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { apply, load_calls } from "./replay.js"
import { ignorer, parse_ignore } from "./ignore.js"
import { skipped } from "./skip.js"
import { plans_path } from "./harness-settings.js"

const SESSIONS = ".pi/agent/sessions"
/** Edits a later actor must replay: harness path to base, target, and calls. */
const DEFERRED = "can://~/.pi/agent/deferred.json"
/** Where a whole harness lives in storage. */
export const HARNESS = "can://~/harness/"
const HARNESS_DEFERRED = `${HARNESS}.pi/agent/deferred.json`
/** A person's own ignore rules, at the harness root. */
export const IGNORE_FILE = ".ignore"
/** The whole harness syncs once its ignore file exists here or in storage. */
export async function whole_enabled(root, store) {
  if (existsSync(join(root, IGNORE_FILE))) return true
  if (!store?.cat) return false
  return store.cat(`${HARNESS}${IGNORE_FILE}`).then(() => true, (error) => {
    if (error.status === 404) return false
    throw error
  })
}
// Sync's own records and derived indexes never travel as harness files.
const INTERNAL = [SESSIONS, ".pi/agent/deferred.json", ".pi/agent/memory.db"]
const is_internal = (path) => INTERNAL.some((name) => path === name || path.startsWith(`${name}/`) || path.startsWith(`${name}-`))
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex")

const run = promisify(execFile)

/** BRAYNESS_ROOT, else the nearest harness package, ignore file, Pi config, or vault plans. */
export function find_root(start = process.cwd(), env = process.env) {
  if (env.BRAYNESS_ROOT) return resolve(env.BRAYNESS_ROOT)
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    const package_file = join(dir, "package.json")
    if (existsSync(package_file) && JSON.parse(readFileSync(package_file, "utf8")).brayness) return dir
    if ([IGNORE_FILE, ".pi/agent", "vault/plans"].some((marker) => existsSync(join(dir, marker)))) return dir
    if (dirname(dir) === dir) throw new Error("no harness here: no harness package.json, .ignore, .pi/agent, or vault/plans/ above, and BRAYNESS_ROOT is unset")
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

/** A Syncs entry is a file when it exists as one, or names a file extension. */
export async function is_file_entry(root, path) {
  const info = await stat(join(root, path)).catch(() => null)
  if (info) return info.isFile()
  return !path.endsWith("/") && extname(path) !== ""
}

/**
 * `(path, is_dir) => boolean` for root-relative paths: fixed ignores, the
 * person's `.ignore`, and anything inside a git repo (git carries it).
 */
export async function harness_exclude(root) {
  const ignored = ignorer(parse_ignore(await readFile(join(root, IGNORE_FILE), "utf8").catch(() => "")))
  const repos = new Map()
  const is_repo = (dir) => {
    if (!repos.has(dir)) repos.set(dir, existsSync(join(root, dir, ".git")))
    return repos.get(dir)
  }
  return (path, is_dir = false) => {
    if (!path || path === "." || path.startsWith("..")) return false
    if (skipped(path) || ignored(path, is_dir)) return true
    const parts = path.split("/")
    for (let i = 1; i <= (is_dir ? parts.length : parts.length - 1); i++) if (is_repo(parts.slice(0, i).join("/"))) return true
    return false
  }
}

/** Every plan's Syncs paths, named plans only when given. */
export async function plan_syncs(root, names = []) {
  const folder = join(root, plans_path(root))
  const files = names.length
    ? names.map((name) => (name.endsWith(".md") ? name : `${name}.md`))
    : (await readdir(folder).catch((error) => {
      if (error.code === "ENOENT") return []
      throw error
    })).filter((name) => name.endsWith(".md"))
  const found = new Map()
  for (const file of files) {
    const text = await readFile(join(folder, file), "utf8")
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
/**
 * Sync every harness file, minus fixed and personal ignores. Sessions go first,
 * so any edit deferred to them is already saved. While `legacy` holds, the
 * plans' Syncs paths also keep their old places for VM recovery.
 */
export async function sync_harness({ root, store, plans = [], deletes, defer_edits = false, legacy = true }) {
  // No ignore file means nobody has reviewed what a whole sync would send.
  if (!(await whole_enabled(root, store))) {
    const listed = await sync_listed({ root, store, plans, deletes, defer_edits })
    return { harness: null, synced: listed.synced, refused: listed.refused, applied: await settle(root, store, DEFERRED, listed.reports) }
  }
  const exclude = await harness_exclude(root)
  const sessions = join(root, SESSIONS)
  const options = { deletes, sessions, sessions_remote: `${HARNESS}${SESSIONS}/` }
  const history = await store.sync(sessions, `${HARNESS}${SESSIONS}/`, { ...options, exclude: (path, is_dir) => exclude(`${SESSIONS}/${path}`, is_dir) })
  const files = await store.sync(root, HARNESS, { ...options, defer_edits, exclude: (path, is_dir) => is_internal(path) || exclude(path, is_dir) })
  const listed = legacy ? await sync_listed({ root, store, plans, deletes, defer_edits }) : { synced: {}, refused: {}, reports: [] }
  // Replay saved edits only after every sync ran, or a later sync sees them as a conflict.
  const applied = await settle(root, store, HARNESS_DEFERRED, [["", files]])
  if (legacy) applied.push(...(await settle(root, store, DEFERRED, listed.reports)))
  return { harness: { sessions: history, files }, synced: listed.synced, refused: listed.refused, applied: [...new Set(applied)].sort() }
}

/** Retire pending edits real bytes now settle, record new ones, then replay any pending. */
async function settle(root, store, location, reports) {
  const pending = await read_deferred(store, location)
  const applied = await apply_deferred(root, pending)
  let changed = false
  const key = (base, name) => (base ? `${base}/${name}` : name)
  for (const [base, report] of reports) {
    for (const name of ["pushed", "adopted", "replayed", "kept_both", "deleted", "removed"].flatMap((kind) => report[kind])) {
      if (pending[key(base, name)]) {
        delete pending[key(base, name)]
        changed = true
      }
    }
    for (const name of report.deferred) {
      if (report.replay[name]) {
        pending[key(base, name)] = report.replay[name]
        changed = true
      }
    }
  }
  if (changed && store.put) await store.put(location, `${JSON.stringify(pending, null, 2)}\n`)
  return applied
}

/** Before h1: each plan's Syncs paths at `can://~/<path>/`. Kept until VM recovery reads `harness/`. */
async function sync_listed({ root, store, plans, deletes, defer_edits }) {
  const exclude = await harness_exclude(root)
  const synced = {}
  const refusals = {}
  const bases = {}
  const paths = await plan_syncs(root, plans)
  // The session bytes must reach storage before any file relies on their edits.
  for (const [path, plan] of [...paths].sort(([a], [b]) => Number(b === ".pi/agent/sessions") - Number(a === ".pi/agent/sessions"))) {
    const local = join(root, path)
    const reason = refused(path) ?? ((await repo_of(local)) ? "inside a git repo" : null)
    if (reason) refusals[path] = `${reason} (${plan})`
    else if (await is_file_entry(root, path)) {
      const folder = dirname(path)
      const remote = folder === "." ? "can://~/" : `can://~/${folder}/`
      synced[path] = await store.sync(dirname(local), remote, { deletes, defer_edits, sessions: join(root, SESSIONS), only: [basename(path)], exclude: (name, is_dir) => exclude(join(folder, name), is_dir) })
      bases[path] = folder === "." ? "" : folder
    } else {
      synced[path] = await store.sync(local, `can://~/${path}/`, { deletes, defer_edits: defer_edits && path !== SESSIONS, sessions: join(root, SESSIONS), exclude: (name, is_dir) => exclude(`${path}/${name}`, is_dir) })
      bases[path] = path
    }
  }
  const reports = Object.entries(synced).filter(([path]) => path !== SESSIONS).map(([path, report]) => [bases[path], report])
  return { synced, refused: refusals, reports }
}

async function read_deferred(store, location) {
  if (!store.cat) return {}
  try {
    return JSON.parse((await store.cat(location)).toString())
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
