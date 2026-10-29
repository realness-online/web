/**
 * m0: past months of memory, sealed. Once a month is over, its turns are
 * written to `<months>/<YYYY-MM>.turns.html.gz`, one row per turn sorted by
 * id, so every device seals the same month the same way. Sync carries the
 * sealed months to `can://~/.memory/turns/`; a new device builds its index
 * from them plus this month's sessions, and never downloads old sessions.
 *
 * A session belongs to the month it started, read from its file name. A
 * device holding more of a month's sessions than the sealed file counts
 * seals it again; one holding fewer leaves it alone.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

const MONTH = /^(\d{4}-\d{2})-\d{2}T/
const SUFFIX = '.turns.html.gz'
/** A month another device sealed, pulled by sync as its plain HTML. */
const PLAIN = '.turns.html'
const OS_BYTE = 9
const UNIX = 3

/** The month a session started, from its name, or null. */
export const month_of = name => MONTH.exec(name.split('/').at(-1) ?? '')?.[1] ?? null

/** This month, as `YYYY-MM`, in UTC like session names. */
export const this_month = (now = new Date()) => now.toISOString().slice(0, 7)

/** Whether a session name falls in a month that is already over. */
export const is_past = (name, now = new Date()) => {
  const month = month_of(name)
  return month !== null && month < this_month(now)
}

const escape = text =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;')
const unescape = text =>
  text.replace(/&#10;/g, '\n').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&')

/** One zip for the same rows on any machine: mtime 0, a fixed OS byte. */
const zip = text => {
  const packed = gzipSync(text, { level: 6 })
  packed.writeUInt32LE(0, 4)
  packed[OS_BYTE] = UNIX
  return packed
}

/**
 * @typedef {{ turn_id: string, session_id: string, session: string, project: string, ts: string, text: string }} Row
 */

/** @param {Row[]} rows @param {number} sessions */
export const month_html = (rows, sessions) =>
  [
    `<meta name="sessions" content="${sessions}">`,
    ...[...rows]
      .sort((a, b) => (a.turn_id < b.turn_id ? -1 : a.turn_id > b.turn_id ? 1 : 0))
      .map(
        row =>
          `<article itemscope itemtype="/turns" itemid="${escape(row.turn_id)}" data-session-id="${escape(row.session_id)}" data-session="${escape(row.session)}" data-project="${escape(row.project)}"><time>${escape(row.ts)}</time><p>${escape(row.text)}</p></article>`
      )
  ].join('\n') + '\n'

const ROW =
  /^<article itemscope itemtype="\/turns" itemid="([^"]*)" data-session-id="([^"]*)" data-session="([^"]*)" data-project="([^"]*)"><time>([^<]*)<\/time><p>([^<]*)<\/p><\/article>$/

const GZIP = Buffer.from('1f8b', 'hex')

/** @returns {{ sessions: number, rows: Row[] }} */
export const read_month = bytes => {
  const text = bytes.subarray(0, 2).equals(GZIP) ? gunzipSync(bytes) : bytes
  const lines = text.toString('utf8').split('\n')
  const sessions = Number(/content="(\d+)"/.exec(lines[0] ?? '')?.[1] ?? 0)
  const rows = []
  for (const line of lines.slice(1)) {
    const match = ROW.exec(line)
    if (!match) continue
    const [, turn_id, session_id, session, project, ts, text] = match.map(unescape)
    rows.push({ turn_id, session_id, session, project, ts, text })
  }
  return { sessions, rows }
}

/** The sealed months on disk, month to path, packed or as sync pulled it. */
export const sealed_months = folder => {
  if (!existsSync(folder)) return new Map()
  const found = new Map()
  for (const name of readdirSync(folder).sort()) {
    const suffix = [SUFFIX, PLAIN].find(end => name.endsWith(end))
    if (suffix) found.set(name.slice(0, -suffix.length), join(folder, name))
  }
  return found
}

const portable = (root, file) => relative(root, file).split(sep).join('/')

/**
 * Seal every past month this device holds more sessions of than its file.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ root: string, folder: string, files: string[], now?: Date }} options
 * @returns {string[]} the months written
 */
export const seal = (db, { root, folder, files, now = new Date() }) => {
  /** @type {Map<string, string[]>} */
  const by_month = new Map()
  for (const file of files) {
    const name = portable(root, file)
    if (!is_past(name, now)) continue
    const month = /** @type {string} */ (month_of(name))
    by_month.set(month, [...(by_month.get(month) ?? []), file])
  }
  const sealed = sealed_months(folder)
  const written = []
  const select = db.prepare(
    'SELECT turn_id, session_id, session_file, project, ts, text FROM turn WHERE session_file = ?'
  )
  for (const [month, month_files] of by_month) {
    const path = sealed.get(month)
    if (path) {
      const { sessions, rows } = read_month(readFileSync(path))
      const names = new Set(rows.map(row => row.session))
      const same = month_files.every(file => names.has(portable(root, file)))
      if (sessions > month_files.length || (sessions === month_files.length && same)) continue
    }
    const rows = month_files.flatMap(file =>
      /** @type {Array<Record<string, string>>} */ (select.all(file)).map(row => ({
        turn_id: String(row.turn_id),
        session_id: String(row.session_id),
        session: portable(root, file),
        project: String(row.project),
        ts: String(row.ts),
        text: String(row.text)
      }))
    )
    mkdirSync(folder, { recursive: true })
    const html = month_html(rows, month_files.length)
    const target = path ?? join(folder, `${month}${SUFFIX}`)
    writeFileSync(target, target.endsWith(SUFFIX) ? zip(html) : html)
    written.push(month)
  }
  return written
}

/**
 * Load sealed months the index has not seen at their current mtime. Their
 * turns point at session files that may not be on this device; a turn a
 * local session already gave is kept as indexed.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ root: string, folder: string, force?: Set<string> }} options
 * @returns {number} turns loaded
 */
export const load = (db, { root, folder, force = new Set() }) => {
  let loaded = 0
  const seen = db.prepare('SELECT mtime_ms FROM session_file WHERE path = ?')
  for (const [month, path] of sealed_months(folder)) {
    const mtime = statSync(path).mtimeMs
    const known = /** @type {{ mtime_ms: number } | undefined} */ (seen.get(path))
    if (known?.mtime_ms === mtime && !force.has(month)) continue
    const { rows } = read_month(readFileSync(path))
    db.exec('BEGIN')
    try {
      const insert = db.prepare(
        'INSERT OR IGNORE INTO turn(turn_id, session_id, session_file, project, ts, text) VALUES (?,?,?,?,?,?)'
      )
      for (const row of rows)
        insert.run(row.turn_id, row.session_id, join(root, row.session), row.project, row.ts, row.text)
      db.prepare(
        'INSERT OR REPLACE INTO session_file(path, mtime_ms, turns, indexed_at) VALUES (?,?,?,?)'
      ).run(path, mtime, rows.length, new Date().toISOString())
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    loaded += rows.length
  }
  return loaded
}
