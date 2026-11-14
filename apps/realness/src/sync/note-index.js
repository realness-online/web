/**
 * s1: the note index, written by whoever changes a note. One rule for a note's
 * title, shared with the memory extension's scan.
 */
import { DatabaseSync } from 'node:sqlite'

/**
 * A note's title. A folder plan, `<Plan>/index.md`, is named by its folder,
 * since its filename names every folder plan alike.
 * @param {string} path vault-relative path
 * @returns {string}
 */
const note_title = path => {
  const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path
  const FOLDER = -2
  return name === 'index' ? (path.split('/').at(FOLDER) ?? name) : name
}

/**
 * Put one note in the index, so a reader sees the text now on disk.
 * @param {{ index: string, path: string, text: string, mtime_ms: number }} note
 */
export const write_note = ({ index, path, text, mtime_ms }) => {
  const db = new DatabaseSync(index)
  try {
    db.prepare(
      'INSERT OR REPLACE INTO note(path, mtime_ms, title, text) VALUES (?, ?, ?, ?)'
    ).run(path, mtime_ms, note_title(path), text)
  } finally {
    db.close()
  }
}

/**
 * Drop one note from the index, for a note deleted from disk.
 * @param {{ index: string, path: string }} note
 */
export const drop_note = ({ index, path }) => {
  const db = new DatabaseSync(index)
  try {
    db.prepare('DELETE FROM note WHERE path = ?').run(path)
  } finally {
    db.close()
  }
}
