/**
 * The edit log: what each session edit left behind, by fingerprint.
 *
 * Sync reads it to tell an explained change from an unexplained one: a file
 * whose current hash matches its last logged hash was last touched by a
 * session, and the log says which. Lives beside the sync records, never in
 * synced folders. `sha` is sha256 hex of the bytes, as sync computes it; null
 * means the edit left no file.
 */
/**
 * @typedef {object} Edit
 * @property {string} path
 * @property {string | null} sha
 * @property {string} session
 * @property {number} turn
 * @property {string} tool
 * @property {string} tool_call
 * @property {string} ts
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/**
 * Point BRAYNESS_STATE at this harness's state folder unless already set:
 * package.json's brayness.state, default `.pi/agent/state`. Matches sync's
 * `use_harness_state`; child processes inherit it.
 */
/**
 * @param {string} root
 * @returns {string}
 */
export const useHarnessState = (root) => {
  if (!process.env.BRAYNESS_STATE) {
    let path = '.pi/agent/state'
    try {
      path = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).brayness?.state ?? path
    } catch {}
    process.env.BRAYNESS_STATE = join(root, path)
  }
  return process.env.BRAYNESS_STATE
}

/** The state folder: BRAYNESS_STATE, else the old home location. */
export const stateDir = () => process.env.BRAYNESS_STATE ?? join(homedir(), '.local/state/brayness')
export const logPath = () => join(stateDir(), 'edits.db')
/** @param {Uint8Array} bytes */
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
/**
 * @param {string} [path]
 * @returns {DatabaseSync}
 */
export const openLog = (path = logPath()) => {
  mkdirSync(dirname(path), {
    recursive: true,
  })
  const db = new DatabaseSync(path)
  db.exec(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS edit (
			id INTEGER PRIMARY KEY,
			path TEXT NOT NULL,
			sha TEXT,
			session TEXT NOT NULL,
			turn INTEGER NOT NULL,
			tool TEXT NOT NULL,
			tool_call TEXT NOT NULL,
			ts TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS edit_path ON edit (path, id);
	`)
  return db
}
/**
 * @param {DatabaseSync} db
 * @param {Edit} edit
 */
export const record = (db, edit) => {
  db.prepare(
    'INSERT INTO edit (path, sha, session, turn, tool, tool_call, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(edit.path, edit.sha, edit.session, edit.turn, edit.tool, edit.tool_call, edit.ts)
}

/** The newest logged edit to a path, or undefined. */
/**
 * @param {DatabaseSync} db
 * @param {string} path
 * @returns {Edit | undefined}
 */
export const last = (db, path) => {
  return /** @type {Edit | undefined} */ (
    db
      .prepare(
        'SELECT path, sha, session, turn, tool, tool_call, ts FROM edit WHERE path = ? ORDER BY id DESC LIMIT 1',
      )
      .get(path)
  )
}
