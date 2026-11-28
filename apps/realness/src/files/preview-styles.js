/**
 * Synced HTML opens styled from disk: each file links the Realness `style.css`.
 */
import {
  readFile as read_file,
  writeFile as write_file
} from 'node:fs/promises'

const SITE = 'https://realness.online'

/** The stylesheets a previewed file links, in cascade order. */
export const PREVIEW_STYLES = ['style.css'].map(name => `${SITE}/${name}`)

/** The link block a previewed file opens with. */
export const PREVIEW_LINK = PREVIEW_STYLES.map(
  href => `<link rel="stylesheet" href="${href}">`
).join('\n')

/** The block an earlier sync put above everything, doctype included. */
const TOP_BLOCK = new RegExp(
  `^(?:<link rel="stylesheet" href="(?:${PREVIEW_STYLES.map(href =>
    href.replace(/[.]/g, '\\.')
  ).join('|')})">\\n)+`
)

/**
 * The text with no preview stylesheet block above its doctype.
 * @param {string} text
 * @returns {string}
 */
export const without_top_block = text => text.replace(TOP_BLOCK, '')

/**
 * The file's text with every missing preview stylesheet linked: inside
 * `<head>` for a whole page, after the doctype for a page without one, else at
 * the top of an items-only file. Text that
 * already links them all comes back unchanged.
 * @param {string} text
 * @returns {string}
 */
export const with_preview_styles = text => {
  const page = /<!doctype html>/i.test(text) ? without_top_block(text) : text
  const missing = PREVIEW_STYLES.filter(
    href => !page.includes(`href="${href}"`)
  )
  if (!missing.length) return page
  const links = missing
    .map(href => `<link rel="stylesheet" href="${href}">`)
    .join('\n')
  const head =
    /<head\b[^>]*>(?:\s*<meta\s+charset[^>]*>)?/i.exec(page) ??
    /<!doctype html>/i.exec(page)
  if (!head) return `${links}\n${page}`
  const at = head.index + head[0].length
  return `${page.slice(0, at)}\n${links}${page.slice(at)}`
}

/**
 * A synced file a person previews: HTML in the vault. Project code under
 * `work/` and `apps/` links no remote stylesheet.
 * @param {string} name the sync name, relative to the harness root
 */
export const is_vault_html = name =>
  name.endsWith('.html') && (name.startsWith('vault/') || !name.includes('/'))

/** A session transcript: pi appends its entries and sync merges them one by one. */
const SESSION = 'itemtype="/sessions/'

/**
 * Link the preview stylesheets into one plain HTML file on disk, before sync
 * reads it, so the version sync hashes is the file's final text. A session
 * transcript stays entries only.
 * @param {string} name the sync name
 * @param {string | undefined} path the file on disk
 * @returns {Promise<boolean>} whether the file changed
 */
export const style_local = async (name, path) => {
  if (!path || !is_vault_html(name) || !path.endsWith('.html')) return false
  const text = await read_file(path, 'utf8')
  if (text.includes(SESSION)) return false
  const styled = with_preview_styles(text)
  if (styled === text) return false
  await write_file(path, styled)
  return true
}
