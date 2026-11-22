/**
 * The blog inside the app: the published renderer's own article and index
 * markup, rendered in the browser from the vault's note text.
 */
import { render_article } from '#root/tools/publish/renderer/src/render.js'
import { poster } from '#root/tools/publish/renderer/src/templates/figure.js'
import { article_body } from '#root/tools/publish/renderer/src/templates/article.js'
import { index_body } from '#root/tools/publish/renderer/src/templates/index.js'
import { read_articles, read_note } from '@/utils/vault-items'

/** The published blog's poster address, served from the vault instead. */
const POSTER_SRC = 'src="/posters/'
const PUBLIC_POSTER = 'src="/v1/poster/'
const VIEW_BOX = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/
/** The app's blog has no site of its own; the poster reads none of it. */
const NO_SITE =
  /** @type {import('#root/tools/publish/renderer/src/types.js').Site} */ ({
    tagline: '',
    description: ''
  })

/**
 * @typedef {{ slug: string, data: Record<string, any>, title: string, html: string, notes: string }} Rendered
 * @typedef {Record<string, { width: number, height: number }>} Sizes
 */

/**
 * The slug an article note is served at: its file name.
 * @param {string} path vault path
 */
export const blog_slug = path =>
  path.split('/').pop()?.replace(/\.md$/, '') ?? ''

/**
 * Poster images read from the vault, at an address an image can use.
 * @param {string} html
 */
const served = html => html.replaceAll(POSTER_SRC, PUBLIC_POSTER)

/**
 * A poster's size, from its viewBox, or null.
 * @param {string} svg
 */
export const poster_size = svg => {
  const box = svg.match(VIEW_BOX)
  return box ? { width: Number(box[1]), height: Number(box[2]) } : null
}

/**
 * One note rendered as the published renderer renders it.
 * @param {string} path vault path
 * @param {string} text the note's whole text
 * @returns {Promise<Rendered>}
 */
export const render_note = async (path, text) => {
  const slug = blog_slug(path)
  return { slug, ...(await render_article(text, slug)) }
}

/**
 * One article as the published blog marks it up.
 * @param {Rendered} note
 * @param {Sizes} sizes
 */
export const article_html = ({ data, title, html, notes }, sizes) =>
  served(
    article_body(poster(NO_SITE, sizes))(data, title, html, notes, {
      back: '/blog'
    })
  )

/**
 * The blog index as the published blog marks it up, newest date first.
 * @param {Rendered[]} notes
 * @param {Sizes} sizes
 */
export const index_html = (notes, sizes) => {
  const articles =
    /** @type {import('#root/tools/publish/renderer/src/types.js').Article[]} */ (
      notes.map(({ slug, data, title, html, notes: foot }) => ({
        ...data,
        slug,
        title,
        html,
        notes: foot
      }))
    )
  articles.sort((a, b) =>
    String(b.date ?? '').localeCompare(String(a.date ?? ''))
  )
  return served(
    index_body(poster(NO_SITE, sizes), false, articles, undefined, true)
  )
}

/**
 * @param {string | null} token
 * @returns {RequestInit}
 */
const signed = token => ({
  headers: token ? { authorization: `Bearer ${token}` } : {}
})

/**
 * @param {string} url
 * @param {string | null} token
 */
const page_of = async (url, token) => {
  const response = await fetch(url, signed(token))
  if (!response.ok) throw new Error(`${response.status}`)
  return response.text()
}

/**
 * Each named poster's size. A poster that cannot load is left out.
 * @param {unknown[]} names
 * @returns {Promise<Sizes>}
 */
const sizes_of = async names => {
  const wanted = /** @type {string[]} */ (
    [...new Set(names)].filter(
      name => typeof name === 'string' && /^[\w.-]+\.svg$/.test(name)
    )
  )
  const svgs = await Promise.all(
    wanted.map(name =>
      fetch(`/v1/poster/${encodeURIComponent(name)}`)
        .then(response => (response.ok ? response.text() : ''))
        .catch(() => '')
    )
  )
  /** @type {Sizes} */
  const sizes = {}
  wanted.forEach((name, at) => {
    const size = poster_size(svgs[at])
    if (size) sizes[name] = size
  })
  return sizes
}

/**
 * One vault note, rendered.
 * @param {string} path
 * @param {string | null} token
 */
const note_of = async (path, token) => {
  const note = read_note(
    await page_of(`/v1/vault/note?path=${encodeURIComponent(path)}`, token)
  )
  return render_note(path, note?.text ?? '')
}

/**
 * The article paths the vault holds.
 * @param {string | null} token
 * @returns {Promise<string[]>}
 */
const article_paths = async token =>
  read_articles(await page_of('/v1/vault/articles', token)).map(
    article => article.path
  )

/**
 * The blog index from the vault.
 * @param {string | null} token
 */
export const load_blog = async token => {
  const paths = await article_paths(token)
  const notes = await Promise.all(paths.map(path => note_of(path, token)))
  return index_html(notes, await sizes_of(notes.map(note => note.data.img)))
}

/**
 * One article from the vault, or null when no article has that slug.
 * @param {string} slug
 * @param {string | null} token
 */
export const load_article = async (slug, token) => {
  const paths = await article_paths(token)
  const path = paths.find(one => blog_slug(one) === slug)
  if (!path) return null
  const note = await note_of(path, token)
  return article_html(note, await sizes_of([note.data.img]))
}
