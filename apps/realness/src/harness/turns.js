/**
 * Turn boundaries. A session's turn starts with a snapshot of every harness
 * file sync carries (mtime and size) and ends by diffing against it: whatever changed or
 * vanished in between belongs to that turn, bash included, and is written to
 * the edit log as tool `turn`. Changes between turns never show in a diff,
 * so they stay unexplained.
 *
 * The edit log's schema is shared with `extensions/edit-log/log.js`.
 */
import { createHash as create_hash } from 'node:crypto'
import { mkdirSync as mkdir_sync } from 'node:fs'
import {
  mkdir,
  readFile as read_file,
  readdir,
  rm,
  stat,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  harness_exclude,
  plan_syncs,
  refused,
  whole_enabled
} from './harness.js'
import { skipped_name } from '#root/src/files/skip.js'
/* eslint-disable no-await-in-loop -- tree walks go one entry at a time to bound open files */

const KEY_LENGTH = 16

const sha = bytes => create_hash('sha256').update(bytes).digest('hex')
const turn_file = (state, session) =>
  join(state, 'turns', `${sha(session).slice(0, KEY_LENGTH)}.json`)

/** Absolute path to "mtime:size" for every harness file sync would carry. */
export const snapshot = async root => {
  const found = {}
  const exclude = await harness_exclude(root)
  const visit = async dir => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (skipped_name(entry.name)) continue
      const path = join(dir, entry.name)
      if (
        exclude(relative(root, path).split(sep).join('/'), entry.isDirectory())
      )
        continue
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) {
        const info = await stat(path).catch(() => null)
        if (info) found[path] = `${info.mtimeMs}:${info.size}`
      }
    }
  }
  if (await whole_enabled(root)) await visit(root)
  else
    for (const [path] of await plan_syncs(root)) {
      if (refused(path)) continue
      const target = join(root, path)
      const info = await stat(target).catch(() => null)
      if (info?.isFile()) found[target] = `${info.mtimeMs}:${info.size}`
      else await visit(target)
    }
  return found
}

export const turn_start = async ({ root, state, session }) => {
  const path = turn_file(state, session)
  await mkdir(dirname(path), { recursive: true })
  await write_file(path, JSON.stringify(await snapshot(root)))
}

/** Log what changed since turn_start; returns the paths it logged. */
export const turn_end = async ({ root, state, session, turn }) => {
  const path = turn_file(state, session)
  const before = JSON.parse(await read_file(path, 'utf8').catch(() => 'null'))
  if (!before) return []
  const after = await snapshot(root)
  const changed = [
    ...new Set([...Object.keys(before), ...Object.keys(after)])
  ].filter(file => before[file] !== after[file])
  const db = open_log(join(state, 'edits.db'))
  const last = db.prepare(
    'SELECT sha FROM edit WHERE path = ? ORDER BY id DESC LIMIT 1'
  )
  const insert = db.prepare(
    "INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, ?, ?, ?, 'turn', '', ?)"
  )
  const logged = []
  for (const file of changed.sort()) {
    const now =
      file in after
        ? sha(await read_file(file).catch(() => Buffer.alloc(0)))
        : null
    if (last.get(file)?.sha === now) continue
    insert.run(file, now, session, turn, new Date().toISOString())
    logged.push(file)
  }
  db.close()
  await rm(path, { force: true })
  return logged
}

const open_log = path => {
  mkdir_sync(dirname(path), { recursive: true })
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
