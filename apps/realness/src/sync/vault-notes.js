/**
 * w1: the search index a vault door builds from its source. It is derived:
 * a listing rebuilds it, so it keeps no state of its own. Only notes whose
 * version changed are read again.
 */
import { DatabaseSync } from 'node:sqlite'

/** A note longer than this, in characters, stays out of the index. */
const NOTE_BYTES = 524_288
const TOKENIZE = `unicode61 remove_diacritics 2 tokenchars '_'`
/** How long a listing stays fresh before a read lists again. */
const FRESH_MS = 2000
/** How many notes the index reads from storage at the same time. */
const READ_AT_ONCE = 16

/**
 * A note's title. A folder plan, `<Plan>/index.md`, is named by its folder,
 * since its filename names every folder plan alike.
 * @param {string} path
 */
const note_title = path => {
  const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path
  const FOLDER = -2
  return name === 'index' ? (path.split('/').at(FOLDER) ?? name) : name
}

const open = () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE note (
      path TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      mtime_ms REAL NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE note_fts USING fts5(
      title, text, content = 'note', content_rowid = 'rowid',
      tokenize = "${TOKENIZE}"
    );
    CREATE TRIGGER note_ai AFTER INSERT ON note BEGIN
      INSERT INTO note_fts(rowid, title, text) VALUES (new.rowid, new.title, new.text);
    END;
    CREATE TRIGGER note_ad AFTER DELETE ON note BEGIN
      INSERT INTO note_fts(note_fts, rowid, title, text) VALUES ('delete', old.rowid, old.title, old.text);
    END;
  `)
  return db
}

/**
 * @param {import('./vault-source.js').VaultSource} source
 * @param {{ fresh_ms?: number, now?: () => number }} [options]
 */
export const vault_notes = (
  source,
  { fresh_ms = FRESH_MS, now = Date.now } = {}
) => {
  const db = open()
  /** @type {Record<string, import('./vault-source.js').VaultFile>} */
  let files = {}
  let checked = -Infinity
  /** @type {Promise<void> | null} */
  let running = null

  const refresh = async () => {
    const listed = await source.list()
    const known = new Map(
      db
        .prepare('SELECT path, version FROM note')
        .all()
        .map(row => [String(row.path), String(row.version)])
    )
    const drop = db.prepare('DELETE FROM note WHERE path = ?')
    const insert = db.prepare(
      'INSERT INTO note(path, version, mtime_ms, title, text) VALUES (?, ?, ?, ?, ?)'
    )
    const changed = Object.entries(listed).filter(
      ([path, { version }]) =>
        path.endsWith('.md') && known.get(path) !== version
    )
    for (let start = 0; start < changed.length; start += READ_AT_ONCE) {
      const batch = changed.slice(start, start + READ_AT_ONCE)
      // eslint-disable-next-line no-await-in-loop -- one batch in memory at a time
      const texts = await Promise.all(batch.map(([path]) => source.read(path)))
      batch.forEach(([path, { version, updated }], at) => {
        const text = texts[at]
        if (known.has(path)) drop.run(path)
        if (text === null || text.length > NOTE_BYTES) return
        insert.run(path, version, Date.parse(updated), note_title(path), text)
      })
    }
    for (const path of known.keys()) if (!listed[path]) drop.run(path)
    files = listed
  }

  return {
    db,
    /** Every file the last listing held, by vault path. */
    files: () => files,
    /** Bring the index up to date when its listing is older than `fresh_ms`. */
    async ready() {
      if (!running && now() - checked >= fresh_ms)
        running = refresh().finally(() => {
          checked = now()
          running = null
        })
      if (running) await running
    },
    /** A write went through sync; the next read lists again. */
    changed() {
      checked = -Infinity
    }
  }
}
