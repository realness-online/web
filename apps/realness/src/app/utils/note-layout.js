import { layout_of } from '#root/tools/publish/renderer/src/layouts.js'
import {
  LEADING_H1,
  render_article
} from '#root/tools/publish/renderer/src/render.js'
import { article_body } from '#root/tools/publish/renderer/src/templates/article.js'
import {
  escape_html,
  format_date
} from '#root/tools/publish/renderer/src/text.js'

const STATIC = '/tools/publish/renderer/static/'
const files = import.meta.glob(
  [
    '/tools/publish/renderer/static/*.css',
    '/tools/publish/renderer/static/layouts/*.{css,js}',
    '/tools/publish/renderer/static/scripts/*.{css,js}'
  ],
  { query: '?raw', import: 'default' }
)
const SITE = { name: 'Realness', url: '', description: '', poster: '' }
const STYLE_LINK = /<link rel="stylesheet" href="\/([^"]+\.css)">/g
const MODULE = /<script type="module" src="\/([^"]+\.js)"><\/script>/g

/** The note's title and date, without the blog's poster image. */
const heading = ({ created }, title) => {
  const time = created
    ? `<time itemprop="datePublished" datetime="${escape_html(created)}">${escape_html(format_date(created))}</time>`
    : ''
  return `<header><h1 itemprop="headline">${escape_html(title)}</h1>${time}</header>`
}

const note_body = article_body(heading)

/**
 * Put each linked renderer file into the page, so the frame opens whole.
 * @param {string} html
 * @param {RegExp} pattern
 * @param {(text: string) => string} wrap
 */
const inline = async (html, pattern, wrap) => {
  const found = [...html.matchAll(pattern)]
  const texts = await Promise.all(
    found.map(([, name]) => files[`${STATIC}${name}`]())
  )
  return found.reduce(
    (page, [tag], index) => page.replace(tag, wrap(String(texts[index]))),
    html
  )
}

/**
 * A note whose `layout:` line names a frame, as that whole page; null for a
 * note the app draws itself.
 * @param {{ text: string, path: string, title: string, itemid?: string | null, layout?: string, created?: string }} note the note's body, front matter removed
 * @returns {Promise<string | null>}
 */
export const framed_note = async ({
  text,
  path,
  title,
  itemid,
  layout,
  created
}) => {
  if (!layout || layout === 'app') return null
  const slug = path.replace(/\.md$/, '')
  const { html, notes } = await render_article(text, slug)
  const body = note_body(
    { itemid, created },
    title,
    html.replace(LEADING_H1, ''),
    notes
  )
  const page = layout_of(SITE, title, body, { layout })
  const styled = await inline(page, STYLE_LINK, css => `<style>${css}</style>`)
  return inline(styled, MODULE, js => `<script type="module">${js}</script>`)
}
