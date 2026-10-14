#!/usr/bin/env node
import { existsSync as exists_sync, lstatSync as lstat_sync, readFileSync as read_file_sync, readdirSync as readdir_sync, rmSync as rm_sync, statSync as stat_sync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath as file_url_to_path } from "node:url"

const ARTIFACTS = join(dirname(dirname(file_url_to_path(import.meta.url))), "artifacts")
const ROOT = process.env.ARTIFACTS_ROOT ? resolve(process.env.ARTIFACTS_ROOT) : ARTIFACTS
if (ROOT !== ARTIFACTS && !ROOT.startsWith(ARTIFACTS + sep)) {
  console.error(`ARTIFACTS_ROOT must be inside ${ARTIFACTS}`)
  process.exit(2)
}
const args = process.argv.slice(2)
const apply = args.includes("--apply")
const all = args.includes("--all")
const quiet = args.includes("--quiet")
const age_at = args.indexOf("--age-minutes")
const grace_ms = (age_at >= 0 ? Number(args[age_at + 1]) : 60) * 60_000

const twin = /^(.*)-(\d{4})(\.[^.]*)?$/

const size_of = (path) => {
  const stat = lstat_sync(path)
  if (!stat.isDirectory()) return stat.size
  let bytes = 0
  for (const entry of readdir_sync(path, { withFileTypes: true })) bytes += size_of(join(path, entry.name))
  return bytes
}

/** A `.live` file names the pid of the tool using its folder. */
const live = (dir) => {
  const marker = join(dir, ".live")
  if (!exists_sync(marker)) return false
  const pid = Number(read_file_sync(marker, "utf8").trim())
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === "EPERM"
  }
}

/** Walk artifacts/, collecting whole directories and leaf files to judge. */
const collect = (dir, dirs, files) => {
  for (const entry of readdir_sync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (live(path)) continue
      if (entry.name === "node_modules" || entry.name === ".git") dirs.push(path)
      else if (entry.name === "dist" && exists_sync(join(dir, "package.json"))) dirs.push(path)
      else collect(path, dirs, files)
    } else if (entry.isFile()) {
      if (entry.name === ".DS_Store") dirs.push(path)
      else files.push(path)
    }
  }
}

/** A higher numbered twin whose lower number sits beside it at the same size. */
const twin_of = (path) => {
  const match = twin.exec(path)
  if (!match) return null
  const [, stem, number, ext = ""] = match
  const lower = `${stem}-${String(Number(number) - 1).padStart(4, "0")}${ext}`
  if (!exists_sync(lower) || !lstat_sync(lower).isFile()) return null
  return stat_sync(lower).size === stat_sync(path).size ? lower : null
}

const items = []
const seen = new Set()
const add = (path, why) => {
  if (seen.has(path)) return
  seen.add(path)
  const stat = lstat_sync(path)
  const bytes = size_of(path)
  if (!all && Date.now() - stat.mtimeMs < grace_ms) return
  items.push({ path, why, bytes })
}

const dirs = []
const files = []
if (exists_sync(ROOT)) collect(ROOT, dirs, files)
for (const path of dirs) add(path, "regenerable")
for (const path of files) {
  const lower = twin_of(path)
  if (lower) add(path, `twin of ${relative(ROOT, lower)}`)
}

const total = items.reduce((sum, item) => sum + item.bytes, 0)
if (!quiet) {
  for (const item of items.sort((a, b) => b.bytes - a.bytes)) {
    console.log(`${apply ? "prune" : "would prune"} ${relative(ROOT, item.path)} (${item.why}, ${item.bytes} bytes)`)
  }
}
if (apply) for (const item of items) rm_sync(item.path, { recursive: true, force: true })
console.log(`${apply ? "pruned" : "would prune"} ${items.length} item(s), freed ${total} bytes`)
