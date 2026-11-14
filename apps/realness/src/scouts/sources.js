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
