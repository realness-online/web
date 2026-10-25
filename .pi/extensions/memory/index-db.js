/**
 * Session memory index
 *
 * A durable FTS5 index over pi's own session transcripts, so recall can rank
 * and filter turns instead of grepping file paths. Exists because `rg` over
 * `.pi/agent/sessions/` returns unranked files and cannot tell a decision
 * from a tool dump - the signal is a few percent of the lines.
 *
 * The store is a standalone SQLite file. Content lives in the JSONL files and
 * is never copied: an external-content FTS5 table stores only the index, and
 * `text` holds just enough to rank and snippet. Nothing secret is duplicated.
 *
 * One row per turn: a user turn with the following assistant text, or an
 * assistant turn on its own. Thinking blocks are dropped; tool results are
 * reduced to a name, error line, or touched path.
 */
/**
 * @typedef {object} Result
 * @property {string} turn_id
 * @property {string} session_id
 * @property {string} session_file
 * @property {string} project
 * @property {string} ts
 * @property {string} text
 * @typedef {object} IndexStats
 * @property {string} path
 * @property {number} turns
 * @property {number} sessions
 * @property {number} bytes
 * @typedef {object} Turn
 * @property {string} turn_id
 * @property {string} session_id
 * @property {string} session_file
 * @property {string} project
 * @property {string} ts
 * @property {string} text
 * @typedef {object} IndexOptions
 * @property {string} [root]
 * @property {string} [path]
 * @property {boolean} [full]
 * @property {(done: number, total: number, file: string) => void} [onProgress]
 * @typedef {object} RecallOptions
 * @property {string} [path]
 * @property {string} [project]
 * @property {number} [limit]
 * @property {string} [since]
 * @property {boolean} [partial]
 * @property {string} [exclude_session]
 */
import { DatabaseSync } from 'node:sqlite'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
const decode_session = promisify(exec_file)

/** Use the launcher's installed, read-only decoder rather than fork sources. */
/**
 * @param {string} file
 * @returns {Promise<string>}
 */
const read_session_text = async file => {
  if (file.endsWith('.jsonl')) return readFile(file, 'utf8')
  const reader = process.env.PI_SESSION_READER
  if (!reader) throw new Error('PI_SESSION_READER is required for HTML session recall; launch through .pi/bin/pi')
  const { stdout } = await decode_session(process.execPath, [reader, file], {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024
  })
  return stdout
}

/**
 * Sessions live under the agent directory, which pi reports as
 * `PI_CODING_AGENT_DIR` - a project-local `.pi/agent` when realness runs through
 * `.pi/bin/pi`, and `~/.pi/agent` under a bare pi install. Both the tree and the
 * store follow it so a checkout and a global install keep separate memories.
 *
 * The fallback is deliberately `~/.pi/agent`: it is where pi itself would put
 * sessions, so the index follows the transcripts rather than inventing a
 * second location. The launcher sets the checkout's agent and session paths;
 * an existing global Pi home stays separate.
 */
/** @returns {string} */
const agentDir = () => {
  const fromEnv = process.env.PI_CODING_AGENT_DIR
  if (fromEnv) return resolve(fromEnv)
  return join(homedir(), '.pi', 'agent')
}
export const SESSIONS_DIR = process.env.PI_CODING_AGENT_SESSION_DIR
  ? resolve(process.env.PI_CODING_AGENT_SESSION_DIR)
  : join(agentDir(), 'sessions')
export const DB_PATH = join(agentDir(), 'memory.db')
const SCHEMA_VERSION = 1

/** How much of a turn to keep for ranking. A turn longer than this ranks and
 *  snippets from its head, which is where the question and the decision are. */
const MAX_TEXT_CHARS = 4000

/** FTS5 tokenizer: unicode61 folds case and accents, `_` is kept as a
 *  character so `resume_pointer` and `bm25` stay single tokens. */
const TOKENIZE = `unicode61 remove_diacritics 2 tokenchars '_'`
const HIGHLIGHT_OPEN = '\u0001'
const HIGHLIGHT_CLOSE = '\u0002'

/** Yield JSONL and HTML sessions, oldest first by mtime. */
/**
 * @param {string} [root]
 * @returns {string[]}
 */
const listSessionFiles = (root = SESSIONS_DIR) => {
  if (!existsSync(root)) return []
  /** @type {string[]} */
  const found = []
  /** @param {string} dir */
  const walk = dir => {
    for (const entry of readdirSync(dir, {
      withFileTypes: true
    })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.jsonl') || entry.name.endsWith('.html') || entry.name.endsWith('.html.gz'))
        found.push(path)
    }
  }
  walk(root)
  return found.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
}
/**
 * @param {unknown} content
 * @returns {string}
 */
const textOf = content => {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  /** @type {string[]} */
  const parts = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const b = /** @type {Record<string, unknown>} */ (block)
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
  }
  return parts.join('\n')
}
/** File path, command, or pattern a tool call touched, or null. */
/**
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @returns {string | null}
 */
const targetOf = (name, args) => {
  /**
   * @param {...string} keys
   * @returns {string | null}
   */
  const pick = (...keys) => {
    for (const key of keys) {
      const value = args[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return null
  }
  switch (name) {
    case 'read':
    case 'write':
    case 'edit':
      return pick('path', 'file_path')
    case 'bash':
      return pick('command')
    case 'grep':
      return pick('pattern')
    case 'glob':
      return pick('pattern')
    case 'project_tooling':
      return pick('project')
    default:
      return pick('path', 'file_path', 'pattern', 'query')
  }
}
/** The searchable text of one message, or "" when it carries no signal. */
/**
 * @param {Record<string, unknown>} message
 * @returns {string}
 */
const searchableOf = message => {
  const role = message.role
  if (role === 'user') return textOf(message.content).trim()
  if (role === 'assistant') {
    /** @type {string[]} */
    const parts = []
    const text = textOf(message.content).trim()
    if (text) parts.push(text)
    const content = message.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== 'object') continue
        const b = /** @type {Record<string, unknown>} */ (block)
        if (b.type !== 'toolCall' || typeof b.name !== 'string') continue
        const args = /** @type {Record<string, unknown>} */ (b.arguments ?? {})
        const target = targetOf(b.name, args)
        parts.push(target ? `${b.name} ${target}` : b.name)
      }
    }
    return parts.join('\n').trim()
  }
  if (role === 'toolResult') {
    const name = typeof message.toolName === 'string' ? message.toolName : 'tool'
    if (message.isError) {
      const detail =
        textOf(message.content)
          .trim()
          .split('\n')
          .find(l => l.trim()) ?? ''
      return detail ? `${name} error ${detail}` : `${name} error`
    }
    return ''
  }
  return ''
}
/**
 * Read one session file into turns.
 *
 * A user message and the assistant text that answers it become a single row,
 * because that pair is the recall unit - the question alone loses the decision,
 * the answer alone loses the ask. Nothing here records who spoke: the index
 * ranks what was said, and a role label was never a thing you filtered on.
 */
/**
 * @param {string} file
 * @returns {Promise<Turn[]>}
 */
export const readSession = async file => {
  const raw = await read_session_text(file)
  /** @type {Turn[]} */
  const turns = []
  let sessionId = ''
  let project = ''
  let index = 0
  /** @type {{ turn_id: string; ts: string; text: string; } | null} */
  let pendingUser = null
  let assistantText = ''
  const flush = () => {
    if (!pendingUser) return
    const pair = [pendingUser.text, assistantText].filter(Boolean).join('\n')
    if (pair) {
      turns.push({
        turn_id: pendingUser.turn_id,
        session_id: sessionId,
        session_file: file,
        project,
        ts: pendingUser.ts,
        text: pair.slice(0, MAX_TEXT_CHARS)
      })
    }
    pendingUser = null
    assistantText = ''
  }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    /** @type {Record<string, unknown>} */
    let entry
    try {
      entry = /** @type {Record<string, unknown>} */ (JSON.parse(line))
    } catch {
      continue
    }
    if (entry.type === 'session') {
      sessionId = String(entry.id ?? sessionId)
      project = String(entry.cwd ?? '')
      continue
    }
    if (entry.type !== 'message') continue
    const message = /** @type {Record<string, unknown>} */ (entry.message ?? {})
    const role = String(message.role ?? '')
    const ts = String(entry.timestamp ?? '')
    if (role === 'toolResult') {
      const failure = searchableOf(message)
      if (failure) {
        turns.push({
          turn_id: String(entry.id ?? `${sessionId}-${index}`),
          session_id: sessionId,
          session_file: file,
          project,
          ts,
          text: failure.slice(0, MAX_TEXT_CHARS)
        })
        index += 1
      }
      continue
    }
    if (role !== 'user' && role !== 'assistant') continue
    const text = searchableOf(message)
    if (!text) continue
    const id = String(entry.id ?? `${sessionId}-${index}`)
    index += 1
    if (role === 'user') {
      flush()
      pendingUser = {
        turn_id: id,
        ts,
        text
      }
      continue
    }
    if (pendingUser) {
      assistantText = assistantText ? `${assistantText}\n${text}` : text
      continue
    }
    turns.push({
      turn_id: id,
      session_id: sessionId,
      session_file: file,
      project,
      ts,
      text: text.slice(0, MAX_TEXT_CHARS)
    })
  }
  flush()
  return turns
}
/**
 * @param {string} [path]
 * @returns {DatabaseSync}
 */
export const openIndex = (path = DB_PATH) => {
  mkdirSync(dirname(path), {
    recursive: true
  })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(`
		CREATE TABLE IF NOT EXISTS index_meta (
			key TEXT PRIMARY KEY,
			value TEXT
		);
		CREATE TABLE IF NOT EXISTS session_file (
			path TEXT PRIMARY KEY,
			mtime_ms REAL NOT NULL,
			turns INTEGER NOT NULL,
			indexed_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS turn (
			turn_id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			session_file TEXT NOT NULL,
			project TEXT NOT NULL,
			ts TEXT NOT NULL,
			text TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS turn_by_project ON turn(project, ts);
		CREATE VIRTUAL TABLE IF NOT EXISTS turn_fts USING fts5(
			text,
			content = 'turn',
			content_rowid = 'rowid',
			tokenize = "${TOKENIZE}"
		);
		CREATE TRIGGER IF NOT EXISTS turn_ai AFTER INSERT ON turn BEGIN
			INSERT INTO turn_fts(rowid, text) VALUES (new.rowid, new.text);
		END;
		CREATE TRIGGER IF NOT EXISTS turn_ad AFTER DELETE ON turn BEGIN
			INSERT INTO turn_fts(turn_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
		END;
		CREATE TRIGGER IF NOT EXISTS turn_au AFTER UPDATE ON turn BEGIN
			INSERT INTO turn_fts(turn_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
			INSERT INTO turn_fts(rowid, text) VALUES (new.rowid, new.text);
		END;
	`)
  db.prepare("INSERT OR IGNORE INTO index_meta(key, value) VALUES ('schema', ?)").run(String(SCHEMA_VERSION))
  return db
}

/** Drop every turn belonging to a session file and its index rows. */
/**
 * @param {DatabaseSync} db
 * @param {string} file
 * @returns {void}
 */
const dropSession = (db, file) => {
  db.prepare('DELETE FROM turn WHERE session_file = ?').run(file)
}
/**
 * Bring the index up to date with the sessions tree. Files whose mtime has
 * not moved are skipped, so a repeat run costs one stat per file.
 */
/**
 * @param {IndexOptions} [options]
 * @returns {Promise<{ scanned: number; indexed: number; turns: number; }>}
 */
export const indexSessions = async (options = {}) => {
  const root = options.root ?? SESSIONS_DIR
  const db = openIndex(options.path)
  const files = listSessionFiles(root)
  /** @type {Map<string, number>} */
  const known = new Map()
  for (const row of /** @type {Array<{ path: string; mtime_ms: number; }>} */ (
    db.prepare('SELECT path, mtime_ms FROM session_file').all()
  )) {
    known.set(row.path, row.mtime_ms)
  }
  let scanned = 0
  let indexed = 0
  let total = 0
  try {
    const newest = files.length ? files[files.length - 1] : null
    for (const file of files) {
      scanned += 1
      options.onProgress?.(scanned, files.length, file)
      const mtime = statSync(file).mtimeMs
      const seen = known.get(file)
      if (!options.full && seen !== undefined && seen === mtime && file !== newest) continue
      const turns = await readSession(file)
      dropSession(db, file)
      db.exec('BEGIN')
      try {
        const insert = db.prepare(
          'INSERT OR REPLACE INTO turn(turn_id, session_id, session_file, project, ts, text) VALUES (?,?,?,?,?,?)'
        )
        for (const turn of turns) {
          insert.run(turn.turn_id, turn.session_id, turn.session_file, turn.project, turn.ts, turn.text)
        }
        db.prepare('INSERT OR REPLACE INTO session_file(path, mtime_ms, turns, indexed_at) VALUES (?,?,?,?)').run(
          file,
          mtime,
          turns.length,
          new Date().toISOString()
        )
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      indexed += 1
      total += turns.length
    }
    const present = new Set(files)
    for (const file of known.keys()) {
      if (present.has(file)) continue
      db.exec('BEGIN')
      try {
        dropSession(db, file)
        db.prepare('DELETE FROM session_file WHERE path = ?').run(file)
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    }
    if (options.full) db.exec("INSERT INTO turn_fts(turn_fts) VALUES ('optimize')")
  } finally {
    db.close()
  }
  return {
    scanned,
    indexed,
    turns: total
  }
}
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'not',
  'of',
  'on',
  'or',
  'our',
  'so',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'will',
  'with',
  'you',
  'your'
])

/**
 * Turn a typed question into an FTS5 MATCH expression.
 *
 * FTS5 treats bare punctuation as syntax, so `fix(bug)` or `firecra*` throw a
 * parse error on a question someone actually typed. Every token is quoted and
 * joined with OR; bm25 then ranks turns matching more terms higher, which is
 * the forgiving behavior a half-remembered query needs.
 */
/**
 * @param {string} text
 * @returns {string | null}
 */
export const toMatchQuery = (text, partial = false) => {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
  const unique = [...new Set(tokens)]
  if (!unique.length) return null
  if (partial) {
    const last = unique[unique.length - 1]
    unique[unique.length - 1] = `${last}*`
  }
  return unique.map(t => `"${t.replace(/"/g, '')}"`).join(' OR ')
}

/** Rank turns against a query, newest first within equal relevance. */
/**
 * @param {string} query
 * @param {RecallOptions} [options]
 * @returns {Result[]}
 */
export const recall = (query, options = {}) => {
  const match = toMatchQuery(query, options.partial)
  if (!match) return []
  const db = openIndex(options.path)
  try {
    const where = ['turn_fts MATCH ?']
    /** @type {Array<string | number>} */
    const args = [match]
    if (options.project) {
      where.push('t.project LIKE ?')
      args.push(`%${options.project}%`)
    }
    if (options.since) {
      where.push('t.ts >= ?')
      args.push(options.since)
    }
    if (options.exclude_session) {
      where.push('t.session_id != ?')
      args.push(options.exclude_session)
    }
    args.push(options.limit ?? 10)
    const rows = /** @type {Array<Record<string, unknown>>} */ (
      db
        .prepare(
          `
			SELECT t.turn_id, t.session_id, t.session_file, t.project, t.ts,
				snippet(turn_fts, 0, ?, ?, ' ... ', 24) AS snippet
			FROM turn_fts
			JOIN turn t ON t.rowid = turn_fts.rowid
			WHERE ${where.join(' AND ')}
			ORDER BY bm25(turn_fts), t.ts DESC
			LIMIT ?
		`
        )
        .all(HIGHLIGHT_OPEN, HIGHLIGHT_CLOSE, ...args)
    )
    return rows.map(row => ({
      turn_id: String(row.turn_id),
      session_id: String(row.session_id),
      session_file: String(row.session_file),
      project: String(row.project),
      ts: String(row.ts),
      text: String(row.snippet ?? '')
        .replaceAll(HIGHLIGHT_OPEN, '**')
        .replaceAll(HIGHLIGHT_CLOSE, '**')
    }))
  } finally {
    db.close()
  }
}
/**
 * @param {string} [path]
 * @returns {IndexStats}
 */
export const stats = (path = DB_PATH) => {
  if (!existsSync(path))
    return {
      path,
      turns: 0,
      sessions: 0,
      bytes: 0
    }
  const db = openIndex(path)
  try {
    const turns = Number(/** @type {{ n: number; }} */ (db.prepare('SELECT COUNT(*) AS n FROM turn').get()).n)
    const sessions = Number(
      /** @type {{ n: number; }} */ (db.prepare('SELECT COUNT(*) AS n FROM session_file').get()).n
    )
    return {
      path,
      turns,
      sessions,
      bytes: statSync(path).size
    }
  } finally {
    db.close()
  }
}

/** Stable identity for a file, used to detect moves during a rebuild. */
/**
 * @param {string} path
 * @returns {string}
 */
export const fingerprint = path => {
  return createHash('sha1').update(path).digest('hex').slice(0, 12)
}
