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
/** Notes a search returns when the caller does not say. */
export const LIMIT_DEFAULT = 10
const OPEN = '\u0001'
const CLOSE = '\u0002'

/**
 * The same token rule as the memory index: words, OR'd, last one a prefix.
 * @param {unknown} text
 * @returns {string | null} an FTS5 match, or null when no word is long enough
 */
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

/**
 * A vault-relative `.md` path, or null when it would step outside.
 * @param {unknown} path
 * @returns {string | null}
 */
const note_path = path => {
  const clean = normalize(String(path ?? '')).replace(/^\/+/, '')
  if (!clean.endsWith('.md') || clean.startsWith('..')) return null
  if (clean.split(sep).some(part => !part || part.startsWith('.'))) return null
  return clean
}

/**
 * @typedef {{ path: string, title: string, text: string }} VaultHit one ranked note; `text` marks matches with `**`
 */

/**
 * The vault door sync serves at `/v1/vault/`; `ready` is false until all three are set.
 * @param {{ dir: string | null, index: string | null, owner: string | null }} config
 */
export const vault_door = ({ dir, index, owner }) => {
  const ready = Boolean(dir && index && owner)
  return {
    ready,
    /**
     * The caller is the vault owner, through a person or harness pass.
     * @param {{ harness?: string, phone?: string } | null | undefined} who
     */
    allows: who => ready && (who?.harness ?? who?.phone) === owner,
    /**
     * @param {unknown} query
     * @param {number} [limit]
     * @returns {VaultHit[]}
     */
    search(query, limit = LIMIT_DEFAULT) {
      const match = to_match(query)
      if (!match || !index || !exists_sync(index)) return []
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
    /**
     * One note's text, or null when the path is not a note in the vault.
     * @param {unknown} path
     * @returns {Promise<string | null>}
     */
    async note(path) {
      const clean = note_path(path)
      if (!clean || !dir) return null
      try {
        const root = await realpath(dir)
        const full = await realpath(join(root, clean))
        if (!full.startsWith(root + sep)) return null
        return await read_file(full, 'utf8')
      } catch {
        return null
      }
    },
    /**
     * The note a stored key or itemid names, from the index's note text.
     * `key` is public; `itemid` carries the owner's phone.
     * @param {{ key?: unknown, itemid?: unknown }} query
     * @returns {{ path: string, title: string, text: string, itemid: string | null } | null}
     */
    find({ key, itemid }) {
      const by_key = typeof key === 'string' && key
      const by_itemid = !by_key && typeof itemid === 'string' && itemid
      if (!by_key && !by_itemid) return null
      const property = by_key ? 'key' : 'itemid'
      const value = by_key ? key : itemid
      if (!property || !value || !index || !exists_sync(index)) return null
      const escaped = String(value).replace(/[\\%_]/g, '\\$&')
      const db = new DatabaseSync(index, { readOnly: true })
      try {
        const row = db
          .prepare(
            "SELECT path, title, text FROM note WHERE text LIKE ? ESCAPE '\\' LIMIT 1"
          )
          .get(`%\n${property}: "${escaped}"%`)
        if (!row) return null
        const raw = String(row.text)
        const front = /^---\n([\s\S]*?)\n---\n?/.exec(raw)?.[1] ?? ''
        const itemid = /^itemid:\s*"?([^"\n]+)"?\s*$/m.exec(front)?.[1] ?? null
        const text = raw.replace(/^---\n[\s\S]*?\n---\n?/, '')
        return {
          path: String(row.path),
          title: String(row.title),
          text,
          itemid
        }
      } finally {
        db.close()
      }
    }
  }
}
