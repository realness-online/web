/**
 * One place a scout looks, as `Sources.md` numbers it: `## 3. Hacker News`.
 * A section with no number is a note about the list, not a place to look.
 * @typedef {object} Source
 * @property {string} key the name a run takes, like `vuejobs`
 * @property {string} title the heading without its number
 * @property {string} text the section, heading and body
 */

/** A section's name as a run names it: lowercase words joined by dashes. */
const key_of = title =>
  title
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The numbered sections, each a place to look. A run reads one of them. */
export const source_sections = markdown =>
  String(markdown ?? '')
    .split(/^## /m)
    .slice(1)
    .map(text => {
      const [heading] = text.split('\n')
      return { heading: heading.trim(), text: `## ${text.trim()}` }
    })
    .filter(({ heading }) => /^\d+\./.test(heading))
    .map(({ heading, text }) => ({
      key: key_of(heading),
      title: heading.replace(/^\d+\.\s*/, '').trim(),
      text
    }))

/**
 * The URLs a section names, in order, each once. The brief asks for these and
 * no other page, so a run reads the source instead of hunting for it.
 * @param {string} text
 * @returns {string[]}
 */
export const source_urls = text => [
  ...new Set(
    String(text ?? '')
      .match(/https?:\/\/[^\s)<>`"']+/g)
      ?.map(url => url.replace(/[.,;:]+$/, '')) ?? []
  )
]

/**
 * The page patterns a section names, like `https://news.google.com/rss/articles/<id>`:
 * a run may read any page that fits one.
 * @param {string} text
 * @returns {string[]}
 */
export const source_patterns = text => [
  ...new Set(
    String(text ?? '').match(/https?:\/\/[^\s)`"']*<[^>\s]+>[^\s)`"']*/g) ?? []
  )
]

/**
 * Whether a URL is one the source named, or a page under it. The site and the
 * path hold, so a run reads its own board and that board's pages; the query
 * does not, so a search API takes the words a run chooses. A URL written with a
 * `<...>` placeholder stands for every page it names.
 * @param {string} url
 * @param {string} allowed one source URL
 */
export const reads_inside = (url, allowed) => {
  const placeholder = allowed.indexOf('<')
  const named = placeholder === -1 ? allowed : allowed.slice(0, placeholder)
  let here
  let there
  try {
    here = new URL(url)
    there = new URL(named)
  } catch {
    return false
  }
  if (here.origin !== there.origin) return false
  if (placeholder !== -1) return here.pathname.startsWith(there.pathname)
  const path = there.pathname.replace(/\/+$/, '')
  if (here.pathname === path) return true
  return here.pathname.startsWith(`${path}/`)
}

/** A command a section tells the run to run, rather than a page to read. */
const NAMES_COMMAND = /```|\n {4}\S|`[^`]*(?:realness-read|npm |node |git )/

/** A section that reads the vault, not the web. */
const NAMES_VAULT = /\bvault\b|Realness\/Companies/i

/** A URL the writer left half-written, like `.../rss/search?q=`. */
const ELIDED = /(?:^|[\s`(])\.\.\.\/|`\.\.\./

/**
 * Why a source is not ready to run, or '' when it says what it reads. A run
 * starts on a source that names its pages, its command, or the vault; a source
 * still being decided stops the run before pi starts.
 * @param {Source} one
 * @returns {string}
 */
export const source_problem = one => {
  const body = one.text.replace(/^##.*$/m, '').trim()
  if (!body) return `${one.title} says nothing to read`
  if (ELIDED.test(body))
    return `${one.title} leaves a URL half-written; write every URL in full`
  if (
    !source_urls(body).length &&
    !NAMES_COMMAND.test(body) &&
    !NAMES_VAULT.test(body)
  )
    return `${one.title} names no page, command, or vault path`
  return ''
}

/**
 * The one source a run reads, by key.
 * @param {Source[]} sections
 * @param {string} key
 */
export const find_source = (sections, key) => {
  const wanted = key_of(String(key ?? ''))
  const match = sections.find(source => source.key === wanted)
  if (match) return match
  const found = sections.map(source => source.key).join(', ')
  throw new Error(
    found
      ? `no source named ${key}: try ${found}`
      : 'Sources.md holds no ## section'
  )
}
