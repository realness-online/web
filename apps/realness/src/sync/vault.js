/**
 * vlt1: the vault door. The Mac keeps one index of its vault in the memory
 * store; an actor asks it here instead of carrying a copy. Two calls, both
 * read-only: search ranks notes, note reads one note. Only the vault owner's
 * actors may ask, and a note path cannot leave the vault or name a dot path.
 */
import { existsSync as exists_sync } from 'node:fs'
import { readFile as read_file, realpath } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const LIMIT_MAX = 25
const OPEN = '\u0001'
const CLOSE = '\u0002'

/** The same token rule as the memory index: words, OR'd, last one a prefix. */
const to_match = text => {
  const words = [
    ...new Set(
      String(text)
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter(word => word.length > 1)
    )
  ]
  if (!words.length) return null
  const last = words.length - 1
  return words
    .map((word, i) => `"${word}"${i === last ? '*' : ''}`)
    .join(' OR ')
}

/** A vault-relative `.md` path, or null when it would step outside. */
export const note_path = path => {
  const clean = normalize(String(path ?? '')).replace(/^\/+/, '')
  if (!clean.endsWith('.md') || clean.startsWith('..')) return null
  if (clean.split(sep).some(part => !part || part.startsWith('.'))) return null
  return clean
}

/**
 * @param {{ dir: string | null, index: string | null, owner: string | null }} config
 */
export const vault_door = ({ dir, index, owner }) => {
  const ready = Boolean(dir && index && owner)
  return {
    ready,
    /** The caller is the vault owner, through a person or harness pass. */
    allows: who => ready && (who?.harness ?? who?.phone) === owner,
    search(query, limit = 10) {
      const match = to_match(query)
      if (!match || !exists_sync(index)) return []
      const db = new DatabaseSync(index, { readOnly: true })
      try {
        return db
          .prepare(
            `SELECT n.path, n.title, snippet(note_fts, 1, ?, ?, ' ... ', 24) AS snippet
             FROM note_fts JOIN note n ON n.rowid = note_fts.rowid
             WHERE note_fts MATCH ? ORDER BY bm25(note_fts, 4.0, 1.0) LIMIT ?`
          )
          .all(OPEN, CLOSE, match, Math.min(LIMIT_MAX, Math.max(1, limit)))
          .map(row => ({
            path: String(row.path),
            title: String(row.title),
            text: String(row.snippet ?? '')
              .replaceAll(OPEN, '**')
              .replaceAll(CLOSE, '**')
          }))
      } finally {
        db.close()
      }
    },
    /** One note's text, or null when the path is not a note in the vault. */
    async note(path) {
      const clean = note_path(path)
      if (!clean) return null
      try {
        const root = await realpath(dir)
        const full = await realpath(join(root, clean))
        if (!full.startsWith(root + sep)) return null
        return await read_file(full, 'utf8')
      } catch {
        return null
      }
    }
  }
}
