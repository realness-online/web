/**
 * Reads the session edit log that `extensions/edit-log` writes. A file is
 * explained when its current fingerprint is the last one a session logged
 * for its path: nothing outside a session touched it since.
 */
import { existsSync as exists_sync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

export const edit_log = (path) => {
  if (!exists_sync(path)) return { last: () => undefined, since: () => [], explained: () => false, close() {} }
  const db = new DatabaseSync(path, { readOnly: true })
  const query = db.prepare("SELECT sha, session, turn, tool FROM edit WHERE path = ? ORDER BY id DESC LIMIT 1")
  const last = (file) => query.get(file)
  const after = db.prepare("SELECT sha, session, turn, tool, tool_call, ts FROM edit WHERE path = ? AND ts > ? ORDER BY id")
  return {
    last,
    /** Every logged edit to a path after an ISO time, oldest first. */
    since: (file, ts) => after.all(file, ts),
    /** `sha` null asks whether a session left the file absent. */
    explained: (file, sha) => {
      const edit = last(file)
      return edit !== undefined && edit.sha === sha
    },
    close: () => db.close(),
  }
}

export const edit_log_path = (state) => join(state, "edits.db")
