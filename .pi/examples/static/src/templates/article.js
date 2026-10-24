import { escape_html } from '../text.js'

const path_of = (href) => href.replace(/\/+$/, '') || '/'

/**
 * A plan's front matter `related` (a list of `{ title, href }`) makes a group:
 * the plan, then its links. Every page in the group shows the same bar on top.
 * @param {{ title: string, href: string }[] | undefined} links A page with no
 * related group passes undefined and gets an empty bar.
 * @param {string} current This page's path.
 */
export const related_nav = (links, current) => {
  if (!links?.length) return ''
  const here = path_of(current)
  const items = links.map(({ title, href }) => {
    const mark = path_of(href) === here ? ' aria-current="page"' : ''
    return `<li><a itemprop="relatedLink" href="${escape_html(href)}"${mark}>${escape_html(title)}</a></li>`
  })
  return `<nav aria-label="Related"><ul>${items.join('')}</ul></nav>`
}

export const article_body = (poster, data, title, html, notes, related = '') => {
    return `<article itemscope${data.itemid ? ` itemid="${escape_html(data.itemid)}"` : ''} itemtype="http://schema.org/BlogPosting">
      ${related}
      ${poster(data, title, 'h1', null, { close_href: '/' })}
      <section itemprop="articleBody">${html}${notes}</section>
    </article>`
  }
