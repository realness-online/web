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
import { read_frontmatter } from './frontmatter.js'
import { artifact_file, artifact_list } from './vault-artifacts.js'
import { article_summary, newest_first } from './vault-articles.js'
import { command_groups } from './vault-commands.js'
import { key_layouts, key_page } from './vault-keys.js'
import { map_prose, modules_data, ways_in_data } from './vault-maps.js'
import { page_files, tool_page } from './vault-pages.js'
import { plan_summary } from './vault-plans.js'
import { blog_page } from './blog-pages.js'
import { project_root } from '#root/src/settings/layout.js'
import { poster_svg } from './vault-posters.js'

const LIMIT_MAX = 25
/** Notes a search returns when the caller does not say. */
export const LIMIT_DEFAULT = 10
const OPEN = '\u0001'
const CLOSE = '\u0002'

/**
 * The note a relative href names, as its itemid, or null when the href leaves
 * the vault or names a note the index does not hold.
 * @param {string} href a link as the note wrote it
 * @param {string} path the note's vault path
 * @param {(path: string) => string | null} itemid_at an itemid from a vault path
 * @returns {string | null}
 */
const itemid_for = (href, path, itemid_at) => {
  const clean = href.trim().replace(/^<|>$/g, '')
  if (
    !clean ||
    clean.startsWith('/') ||
    clean.startsWith('#') ||
    /^[a-z]+:/i.test(clean)
  )
    return null
  const near = normalize(join(path, '..', decodeURIComponent(clean)))
  return near.startsWith('..') ? null : itemid_at(near)
}

/**
 * The note's body links that name another vault note, as href to itemid. The
 * view rewrites the rendered anchors, so code fences keep their examples.
 * @param {string} text the note's body
 * @param {string} path the note's vault path
 * @param {(path: string) => string | null} itemid_at an itemid from a vault path
 * @returns {Record<string, string>}
 */
const links_of = (text, path, itemid_at) => {
  const links = {}
  for (const [, href] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const itemid = itemid_for(href, path, itemid_at)
    if (itemid) links[href] = `#${itemid}`
  }
  return links
}

/**
 * The maps a note's `related:` key holds, ignoring anything else the key could
 * have been written as.
 * @param {unknown} value
 * @returns {Record<string, unknown>[]}
 */
const related_entries = value =>
  Array.isArray(value)
    ? value.filter(entry => typeof entry === 'object' && entry !== null)
    : []

/**
 * A plan's `related:` header links, each href resolved against the note's own
 * folder. A note the vault holds answers with its itemid; every other href is
 * left as written.
 * @param {Record<string, unknown>[]} entries the note's `related:` maps
 * @param {string} path the note's vault path
 * @param {(path: string) => string | null} itemid_at an itemid from a vault path
 * @returns {{ title: string, href: string }[]}
 */
const related_of = (entries, path, itemid_at) =>
  entries.map(entry => {
    const title = String(entry.title ?? '')
    const clean = String(entry.href ?? '')
    const itemid = itemid_for(clean, path, itemid_at)
    return { title, href: itemid ? `#${itemid}` : clean }
  })

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
/** Files the door reads: a note, a tool page, and the stylesheets beside it. */
const READABLE = ['.md', '.html', '.css']

const note_path = path => {
  const clean = normalize(String(path ?? '')).replace(/^\/+/, '')
  if (!READABLE.some(ends => clean.endsWith(ends)) || clean.startsWith('..'))
    return null
  if (clean.split(sep).some(part => !part || part.startsWith('.'))) return null
  return clean
}

/**
 * @typedef {{ path: string, title: string, text: string }} VaultHit one ranked note; `text` marks matches with `**`
 */

/**
 * The generated tool pages and scratch files, read from disk on each call.
 * @param {{ dir: string | null, artifacts?: string | null }} folders
 */
const tool_readers = ({ dir, artifacts }) => ({
  /**
   * The commands the generated page lists, in its own groups.
   * @returns {Promise<import('./vault-commands.js').CommandGroup[]>}
   */
  async commands() {
    if (!dir) return []
    const text = await read_file(
      join(dir, 'Areas/Realness/pages/commands.html'),
      'utf8'
    ).catch(() => null)
    return text === null ? [] : command_groups(text)
  },
  /**
   * The key maps the generated key layouts page holds.
   * @returns {Promise<import('./vault-keys.js').KeyLayouts | null>}
   */
  async keys() {
    if (!dir) return null
    const [source, markup] = await Promise.all([
      read_file(join(dir, 'Areas/Realness/pages/key-layouts.js'), 'utf8'),
      read_file(join(dir, 'Areas/Realness/pages/key-layouts.html'), 'utf8')
    ]).catch(() => [null, null])
    if (source === null || markup === null) return null
    return { ...key_layouts(source), page: key_page(markup) }
  },
  /**
   * Scratch files in one folder, for the owner only.
   * @param {string} [path]
   * @returns {Promise<{ path: string, name: string, kind: 'folder' | 'file', size: number, mtime_ms: number }[]>}
   */
  async artifacts(path = '') {
    if (!artifacts) return []
    return await artifact_list(artifacts, path)
  },
  /**
   * One scratch file's text, for the owner only.
   * @param {string} path
   * @returns {Promise<{ path: string, text: string } | null>}
   */
  async artifact(path = '') {
    if (!artifacts) return null
    return await artifact_file(artifacts, path)
  },
  /**
   * One map page's data: `modules` or `ways-in`.
   * @param {'modules' | 'ways-in'} page
   * @returns {Promise<object | null>}
   */
  async map_of(page) {
    if (!dir || !['modules', 'ways-in'].includes(page)) return null
    const base = join(dir, `Areas/Realness/pages/maps/${page}`)
    const [text, markup] = await Promise.all([
      read_file(`${base}.js`, 'utf8'),
      read_file(`${base}.html`, 'utf8')
    ]).catch(() => [null, null])
    if (text === null || markup === null) return null
    const data = page === 'modules' ? modules_data(text) : ways_in_data(text)
    return { ...data, ...map_prose(markup) }
  }
})

/**
 * @param {string | null | undefined} dir vault folder
 * @returns {Promise<import('./vault-pages.js').ToolPage[]>}
 */
const tool_pages = async dir => {
  if (!dir || !exists_sync(dir)) return []
  const paths = await page_files(dir)
  const pages = await Promise.all(
    paths.map(async path => {
      const text = await read_file(join(dir, path), 'utf8').catch(() => null)
      return text === null ? null : tool_page(path, text)
    })
  )
  return pages
    .filter(page => page !== null)
    .sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * The vault door sync serves at `/v1/vault/`; `ready` is false until all three are set.
 * @param {{ dir: string | null, index: string | null, owner: string | null, artifacts?: string | null }} config
 */
export const vault_door = ({ dir, index, owner, artifacts }) => {
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
     * Every plan the index holds, by title. A note that is not a plan, or that
     * cannot be read as one, is left out, so one broken note never takes the
     * list with it.
     * @returns {import('./vault-plans.js').PlanSummary[]}
     */
    plans() {
      if (!index || !exists_sync(index)) return []
      const db = new DatabaseSync(index, { readOnly: true })
      try {
        return db
          .prepare("SELECT path, text FROM note WHERE path LIKE 'Projects/%'")
          .all()
          .map(row => {
            const path = String(row.path)
            const folder = path.split('/')[1] ?? ''
            const scout = Boolean(
              dir &&
              path.endsWith('/index.md') &&
              exists_sync(join(dir, 'Projects', folder, 'scout.html'))
            )
            return plan_summary(path, String(row.text), scout)
          })
          .filter(plan => plan !== null)
          .sort((a, b) => a.title.localeCompare(b.title))
      } finally {
        db.close()
      }
    },
    /**
     * Every article the index holds, newest first. A note that is not an
     * article is left out.
     * @returns {import('./vault-articles.js').ArticleSummary[]}
     */
    articles() {
      if (!index || !exists_sync(index)) return []
      const db = new DatabaseSync(index, { readOnly: true })
      try {
        return newest_first(
          db
            .prepare(
              "SELECT path, text FROM note WHERE path LIKE 'Areas/Blog/%'"
            )
            .all()
            .map(row => article_summary(String(row.path), String(row.text)))
            .filter(article => article !== null)
        )
      } finally {
        db.close()
      }
    },
    /**
     * A page an article frames, when the blog app publishes it by that name.
     * @param {unknown} name
     * @returns {Promise<string | null>}
     */
    blog_page(name) {
      return dir ? blog_page(project_root, dir, name) : Promise.resolve(null)
    },
    /**
     * One blog poster's SVG, or null when the vault has no such poster.
     * @param {unknown} name
     * @returns {Promise<string | null>}
     */
    poster(name) {
      return dir ? poster_svg(dir, name) : Promise.resolve(null)
    },
    /**
     * Every tool page in the vault, by title. Read from disk, since the note
     * index holds markdown alone.
     * @returns {Promise<import('./vault-pages.js').ToolPage[]>}
     */
    pages() {
      return tool_pages(dir)
    },
    ...tool_readers({ dir, artifacts }),
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
     * The note one itemid names, with the storage path `can` decides on. There
     * is no lookup by key: a key skips every right.
     * @param {{ itemid?: unknown }} query
     * @returns {{ path: string, storage: string, title: string, text: string, itemid: string | null, related: { title: string, href: string }[], links: Record<string, string> } | null}
     */
    shared({ itemid }) {
      const property = 'itemid'
      const value = typeof itemid === 'string' ? itemid : ''
      if (!value || !index || !exists_sync(index) || !dir) return null
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
        const { data, body: text } = read_frontmatter(raw)
        const itemid = data.itemid ? String(data.itemid) : null
        const itemid_at = near => {
          const other = db
            .prepare('SELECT text FROM note WHERE path = ?')
            .get(near)
          const found = other
            ? /^itemid:\s*"?([^"\n]+)"?\s*$/m.exec(String(other.text))?.[1]
            : null
          return found ?? null
        }
        return {
          path: String(row.path),
          storage: `people/${owner}/harness/vault/${String(row.path)}`,
          title: String(row.title),
          text,
          itemid,
          related: related_of(
            related_entries(data.related),
            String(row.path),
            itemid_at
          ),
          links: links_of(text, String(row.path), itemid_at)
        }
      } finally {
        db.close()
      }
    }
  }
}
