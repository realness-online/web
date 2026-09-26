/**
 * What `brayness sync` carries: the folders each plan names under a
 * `## Syncs` heading, one per list item, relative to the harness root.
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
import { skipped } from "./skip.js"

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
  return found
}

/**
 * Sync every plan's paths to `can://~/<path>/`. Refused paths are named, never
 * synced; the rest still run.
 */
export async function sync_harness({ root, store, plans = [], deletes }) {
  const synced = {}
  const refusals = {}
  for (const [path, plan] of await plan_syncs(root, plans)) {
    const local = join(root, path)
    const reason = refused(path) ?? ((await repo_of(local)) ? "inside a git repo" : null)
    if (reason) refusals[path] = `${reason} (${plan})`
    else synced[path] = await store.sync(local, `can://~/${path}/`, { deletes })
  }
  return { synced, refused: refusals }
}
