/**
 * v3a: a tool page in the vault, rendered by the app. The page stays one item
 * with its own itemid; the app reads it, not a build.
 */
import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/**
 * @typedef {{ title: string, path: string }} ToolPage
 */

const PAGE_PATH = /^Areas\/Realness\/pages\/(?:[^/]+\/)?[^/]+\.html$/

/**
 * A tool page's title: its headline, else its `<title>`, else its filename.
 * @param {string} path vault path
 * @param {string} html the page's whole text
 * @returns {string}
 */
export const page_title = (path, html) => {
  const headline = /<h1[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/h1>/.exec(
    html
  )?.[1]
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]
  const name =
    path
      .split('/')
      .pop()
      ?.replace(/\.html$/, '') ?? path
  return clean_sentence(headline ?? title ?? name)
}

/**
 * Text with its tags and entities gone.
 * @param {string} text
 * @returns {string}
 */
const clean_sentence = text =>
  text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()

/**
 * Every tool page file under the pages folder, as vault paths.
 * @param {string} dir the vault's folder
 * @returns {Promise<string[]>}
 */
export const page_files = async dir => {
  const root = join(dir, 'Areas/Realness/pages')
  const folders = [root, join(root, 'maps')]
  /** @type {import('node:fs').Dirent[][]} */
  const listed = await Promise.all(
    folders.map(folder =>
      readdir(folder, { withFileTypes: true }).catch(() => [])
    )
  )
  return listed.flatMap((entries, at) =>
    entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.html'))
      .map(entry =>
        relative(dir, join(folders[at], entry.name)).split(sep).join('/')
      )
  )
}

/**
 * One tool page, or null when the note is not one.
 * @param {string} path vault path
 * @param {string} html the page's whole text
 * @returns {ToolPage | null}
 */
export const tool_page = (path, html) => {
  if (!PAGE_PATH.test(path)) return null
  return { title: page_title(path, html), path }
}

/**
 * The page body the app shows: the article's own section, without the site's
 * chrome and without scripts, which a view must not run from a string.
 * @param {string} html the page's whole text
 * @returns {string}
 */
export const page_body = html =>
  (
    /<section[^>]*itemprop="articleBody"[^>]*>([\s\S]*?)<\/section>/.exec(
      html
    )?.[1] ??
    /<article\b[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1] ??
    /<main[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] ??
    ''
  )
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<template[\s\S]*?<\/template>/g, '')
    .trim()
