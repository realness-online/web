/**
 * v4: the blog index. An article is a note under `Areas/Blog/` whose itemid
 * names an article; its summary comes from the note's frontmatter and heading.
 */
import { read_frontmatter } from './frontmatter.js'

/**
 * @typedef {{ itemid: string, path: string, title: string, created: string, description: string }} ArticleSummary
 */

/**
 * One article's summary, or null when the note is not an article.
 * @param {string} path vault path
 * @param {string} raw the note's whole text
 * @returns {ArticleSummary | null}
 */
export const article_summary = (path, raw) => {
  if (!/^Areas\/Blog\/.+\.md$/.test(path)) return null
  const { data, body } = read_frontmatter(raw)
  const itemid = data.itemid ? String(data.itemid) : ''
  if (!itemid.includes('/articles/')) return null
  const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path
  return {
    itemid,
    path,
    title:
      (data.title ? String(data.title) : '') ||
      (/^# (.+)$/m.exec(body)?.[1].trim() ?? name),
    created: data.created ? String(data.created) : '',
    description: data.description ? String(data.description) : ''
  }
}

/**
 * Articles newest first, then by title.
 * @param {ArticleSummary[]} articles
 * @returns {ArticleSummary[]}
 */
export const newest_first = articles =>
  [...articles].sort(
    (a, b) =>
      b.created.localeCompare(a.created) || a.title.localeCompare(b.title)
  )
