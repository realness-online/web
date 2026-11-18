import { render } from '@comark/html'
import { parse } from 'comark'
import { highlight, plate, footnote, strip_tags } from './markdown.js'
import { title_case } from './text.js'

export const LEADING_H1 = /^\s*<h1[^>]*>([\s\S]*?)<\/h1>/

/** Front matter's title, else the page's own heading, else its slug. */
export const title_of = (data, named, slug) => {
  if (data.title) return title_case(data.title)
  if (named) return named
  return title_case((slug.split('/').pop() ?? '').replace(/-/g, ' '))
}

/**
 * One article's front matter, title, and body HTML, without writing a page.
 * @param {string} src The note's whole text.
 * @param {string} slug
 */
export const render_article = async (src, slug) => {
  const { frontmatter: data } = await parse(src)
  let body = await render(src)
  const heading = !data.title && body.match(LEADING_H1)
  if (heading) body = body.replace(LEADING_H1, '')
  const title = title_of(data, heading ? strip_tags(heading[1]) : null, slug)
  const { html, notes } = footnote(plate(await highlight(body)))
  return { data, title, html, notes }
}
