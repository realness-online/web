/**
 * A page an article frames. The blog app names the pages it publishes in its
 * `app.json`; only a named page is served, from the vault file the selection
 * names.
 */
import { readFile as read_file, stat } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

const APP = ['apps', 'blog', 'app.json']

/** @type {{ at: number, pages: Map<string, string> } | null} */
let held = null

/**
 * Each published page's name, and the vault folder file behind it.
 * @param {string} app_file
 * @param {string} vault
 */
const read_pages = async (app_file, vault) => {
  const { mtimeMs } = await stat(app_file)
  if (held && held.at === mtimeMs) return held.pages
  const app = JSON.parse(await read_file(app_file, 'utf8'))
  const pages = new Map()
  for (const page of Array.isArray(app.pages) ? app.pages : []) {
    if (typeof page?.path !== 'string' || typeof page?.from !== 'string')
      continue
    if (typeof page?.id !== 'string') continue
    pages.set(page.path, join(vault, page.from))
  }
  held = { at: mtimeMs, pages }
  return pages
}

/**
 * One framed page's HTML, or null when the blog app does not publish it.
 * @param {string} root harness root
 * @param {string} vault vault folder
 * @param {unknown} name the page's published file name
 * @returns {Promise<string | null>}
 */
export const blog_page = async (root, vault, name) => {
  if (
    typeof name !== 'string' ||
    name.includes('..') ||
    !name.endsWith('.html')
  )
    return null
  const app_file = join(root, ...APP)
  const pages = await read_pages(app_file, vault).catch(() => new Map())
  const file = pages.get(name)
  if (!file) return null
  const inside = resolve(file)
  if (
    !inside.startsWith(resolve(vault) + sep) &&
    dirname(inside) !== resolve(vault)
  )
    return null
  return read_file(inside, 'utf8').catch(() => null)
}
