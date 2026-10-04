/**
 * Turn boundaries. A session's turn starts with a snapshot of every harness
 * file sync carries (mtime and size) and ends by diffing against it: whatever changed or
 * vanished in between belongs to that turn, bash included, and is written to
 * the edit log as tool `turn`. Changes between turns never show in a diff,
 * so they stay unexplained.
 *
 * The edit log's schema is shared with `extensions/edit-log/log.ts`.
 */
import { createHash } from "node:crypto"
import { mkdirSync } from "node:fs"
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join, relative, sep } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { harness_exclude, plan_syncs, refused, whole_enabled } from "./harness.js"
import { skipped_name } from "./skip.js"

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex")
const turn_file = (state, session) => join(state, "turns", `${sha(session).slice(0, 16)}.json`)

/** Absolute path to "mtime:size" for every harness file sync would carry. */
export async function snapshot(root) {
  const found = {}
  const exclude = await harness_exclude(root)
  const visit = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (skipped_name(entry.name)) continue
      const path = join(dir, entry.name)
      if (exclude(relative(root, path).split(sep).join("/"), entry.isDirectory())) continue
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) {
        const info = await stat(path).catch(() => null)
        if (info) found[path] = `${info.mtimeMs}:${info.size}`
      }
    }
  }
  if (await whole_enabled(root)) await visit(root)
  else for (const [path] of await plan_syncs(root)) {
    if (refused(path)) continue
    const target = join(root, path)
    const info = await stat(target).catch(() => null)
    if (info?.isFile()) found[target] = `${info.mtimeMs}:${info.size}`
    else await visit(target)
  }
  return found
}

export async function turn_start({ root, state, session }) {
  const path = turn_file(state, session)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(await snapshot(root)))
}

/** Log what changed since turn_start; returns the paths it logged. */
export async function turn_end({ root, state, session, turn }) {
  const path = turn_file(state, session)
  const before = JSON.parse(await readFile(path, "utf8").catch(() => "null"))
  if (!before) return []
  const after = await snapshot(root)
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((file) => before[file] !== after[file])
  const db = open_log(join(state, "edits.db"))
  const last = db.prepare("SELECT sha FROM edit WHERE path = ? ORDER BY id DESC LIMIT 1")
  const insert = db.prepare(
    "INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, ?, ?, ?, 'turn', '', ?)",
  )
  const logged = []
  for (const file of changed.sort()) {
    const now = file in after ? sha(await readFile(file).catch(() => Buffer.alloc(0))) : null
    if (last.get(file)?.sha === now) continue
    insert.run(file, now, session, turn, new Date().toISOString())
    logged.push(file)
  }
  db.close()
  await rm(path, { force: true })
  return logged
}

function open_log(path) {
  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS edit (
      id INTEGER PRIMARY KEY, path TEXT NOT NULL, sha TEXT, session TEXT NOT NULL,
      turn INTEGER NOT NULL, tool TEXT NOT NULL, tool_call TEXT NOT NULL, ts TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS edit_path ON edit (path, id);
  `)
  return db
}
