/**
 * Reads the session edit log that `extensions/edit-log` writes. A file is
 * explained when its current fingerprint is the last one a session logged
 * for its path: nothing outside a session touched it since.
 */
import { existsSync } from "node:fs"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"

export function edit_log(path) {
  if (!existsSync(path)) return { last: () => undefined, explained: () => false, close() {} }
  const db = new DatabaseSync(path, { readOnly: true })
  const query = db.prepare("SELECT sha, session, turn, tool FROM edit WHERE path = ? ORDER BY id DESC LIMIT 1")
  const last = (file) => query.get(file)
  return {
    last,
    /** `sha` null asks whether a session left the file absent. */
    explained: (file, sha) => {
      const edit = last(file)
      return edit !== undefined && edit.sha === sha
    },
    close: () => db.close(),
  }
}

export const edit_log_path = (state) => join(state, "edits.db")
