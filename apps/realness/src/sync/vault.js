/**
 * vlt1: the vault door. It reads one person's vault through a source - the
 * Mac's folder, or cloud storage - and searches an index it builds from that
 * source. Read-only, for the vault owner alone; a path cannot leave the vault
 * or name a dot path.
 */
import { join, normalize, sep } from 'node:path'
import { read_frontmatter } from './frontmatter.js'
import { artifact_file, artifact_list } from './vault-artifacts.js'
import { article_summary, newest_first } from './vault-articles.js'
import { tool_page } from './vault-pages.js'
import { plan_summary } from './vault-plans.js'
import { blog_page } from './blog-pages.js'
import { project_root } from '#root/src/settings/layout.js'
import { poster_svg } from './vault-posters.js'
import { vault_notes } from './vault-notes.js'

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
    if (itemid) links[href] = `/vault${itemid}`
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
    const clean = String(entry.href ?? '').replace(/^\/vault#\//, '/vault/')
    const itemid = itemid_for(clean, path, itemid_at)
    return { title, href: itemid ? `/vault${itemid}` : clean }
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

/** Files the door reads: a note, a tool page, and the styles and scripts beside it. */
const READABLE = ['.md', '.html', '.css', '.js']

/**
 * A vault-relative path the door reads, or null when it would step outside.
 * @param {unknown} path
 * @returns {string | null}
 */
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
 * Scratch files, read from the Mac's disk on each call.
 * @param {string | null | undefined} artifacts
 */
const artifact_readers = artifacts => ({
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
  }
})

/**
 * One row of the index as a plan, with its scout page when the folder has one.
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} files
 */
const plan_of = (row, files) => {
  const path = String(row.path)
  const scout =
    path.endsWith('/index.md') &&
    Boolean(files[path.replace(/index\.md$/, 'scout.html')])
  return plan_summary(path, String(row.text), scout)
}

/**
 * The vault door sync serves at `/v1/vault/`.
 * @param {{ source: import('./vault-source.js').VaultSource | null, owner: string | null, dir?: string | null, artifacts?: string | null }} config
 */
export const vault_door = ({ source, owner, dir = null, artifacts = null }) => {
  const ready = Boolean(source && owner)
  const notes = source ? vault_notes(source) : null
  /** The index, up to date, or null for a door with no source. */
  const indexed = async () => {
    if (!notes) return null
    await notes.ready()
    return notes
  }
  return {
    ready,
    /**
     * The caller is the vault owner, through a person or harness pass.
     * @param {{ harness?: string, phone?: string } | null | undefined} who
     */
    allows: who => ready && (who?.harness ?? who?.phone) === owner,
    /** A write went through sync; the next read lists the source again. */
    changed: () => notes?.changed(),
    /**
     * @param {unknown} query
     * @param {number} [limit]
     * @returns {Promise<VaultHit[]>}
     */
    async search(query, limit = LIMIT_DEFAULT) {
      const match = to_match(query)
      const index = match ? await indexed() : null
      if (!index) return []
      return index.db
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
    },
    /**
     * Every plan the index holds, last updated first. A note that is not a
     * plan, or that cannot be read as one, is left out, so one broken note
     * never takes the list with it.
     * @returns {Promise<import('./vault-plans.js').PlanSummary[]>}
     */
    async plans() {
      const index = await indexed()
      if (!index) return []
      const files = index.files()
      return index.db
        .prepare(
          "SELECT path, text FROM note WHERE path LIKE 'Projects/%' OR path LIKE 'Archive/Projects/%' ORDER BY mtime_ms DESC"
        )
        .all()
        .map(row => plan_of(row, files))
        .filter(plan => plan !== null)
        .filter(
          (plan, at, all) =>
            all.findIndex(other => other.itemid === plan.itemid) === at
        )
    },
    /**
     * Every article the index holds, newest first. A note that is not an
     * article is left out.
     * @returns {Promise<import('./vault-articles.js').ArticleSummary[]>}
     */
    async articles() {
      const index = await indexed()
      if (!index) return []
      return newest_first(
        index.db
          .prepare("SELECT path, text FROM note WHERE path LIKE 'Areas/Blog/%'")
          .all()
          .map(row => article_summary(String(row.path), String(row.text)))
          .filter(article => article !== null)
      )
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
     * Every tool page in the vault, by title.
     * @returns {Promise<import('./vault-pages.js').ToolPage[]>}
     */
    async pages() {
      const index = await indexed()
      if (!index || !source) return []
      const paths = Object.keys(index.files()).filter(path =>
        path.endsWith('.html')
      )
      const texts = await Promise.all(paths.map(path => source.read(path)))
      return paths
        .map((path, at) =>
          texts[at] === null ? null : tool_page(path, String(texts[at]))
        )
        .filter(page => page !== null)
        .sort((a, b) => a.title.localeCompare(b.title))
    },
    ...artifact_readers(artifacts),
    /**
     * One file's text, or null when the path is not one the door reads.
     * @param {unknown} path
     * @returns {Promise<string | null>}
     */
    async note(path) {
      const clean = note_path(path)
      if (!clean || !source) return null
      return await source.read(clean.split(sep).join('/'))
    },
    /**
     * The note one itemid names, with the storage path `can` decides on. There
     * is no lookup by key: a key skips every right.
     * @param {{ itemid?: unknown }} query
     * @returns {Promise<{ path: string, storage: string, title: string, text: string, itemid: string | null, layout: string, created: string, related: { title: string, href: string }[], links: Record<string, string> } | null>}
     */
    async shared({ itemid }) {
      const property = 'itemid'
      const value = typeof itemid === 'string' ? itemid : ''
      const index = value ? await indexed() : null
      if (!index) return null
      const escaped = String(value).replace(/[\\%_]/g, '\\$&')
      const row = index.db
        .prepare(
          "SELECT path, title, text FROM note WHERE text LIKE ? ESCAPE '\\' LIMIT 1"
        )
        .get(`%\n${property}: "${escaped}"%`)
      if (!row) return null
      const raw = String(row.text)
      const { data, body: text } = read_frontmatter(raw)
      const itemid_at = near => {
        const other = index.db
          .prepare('SELECT text FROM note WHERE path = ?')
          .get(near)
        const found = other
          ? /^itemid:\s*"?([^"\n]+)"?\s*$/m.exec(String(other.text))?.[1]
          : null
        return found ?? null
      }
      return {
        path: String(row.path),
        storage: `people/${owner}/vault/${String(row.path)}`,
        title: String(row.title),
        text,
        itemid: data.itemid ? String(data.itemid) : null,
        layout: data.layout ? String(data.layout) : '',
        created: data.created ? String(data.created) : '',
        related: related_of(
          related_entries(data.related),
          String(row.path),
          itemid_at
        ),
        links: links_of(text, String(row.path), itemid_at)
      }
    }
  }
}
