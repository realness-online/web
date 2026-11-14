/**
 * Scout code, as a guest finds and runs it.
 *
 * A plan's `Sources.md` may hold one fenced block per site:
 *
 *     ```js scout yc www.workatastartup.com
 *     export const read = async (url, { cookies, fetcher, brief }) => …
 *     ```
 *
 * The block lives in the vault, so a change to it needs no release. This file
 * is the general part: find the block, take the site's cookies from the door,
 * and run the block with them.
 */
import {
  existsSync as exists_sync,
  readdirSync as read_dir_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { login_of } from './realness-cookies.js'

/** Where a box keeps its owner's saved logins, one folder per owner. */
export const jar_root = () =>
  process.env.REALNESS_JARS ?? '/realness/.pi/agent/secrets/jars'

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"' }
const unescape = text =>
  text.replace(/&(amp|lt|gt|quot);/g, (_, name) => ENTITIES[name])

/**
 * The cookies a box's own jar holds for a site, or null when it holds none.
 * @param {string} site
 * @param {string} [root]
 * @returns {{ name: string, value: string }[] | null}
 */
export const box_cookies = (site, root = jar_root()) => {
  if (!exists_sync(root)) return null
  const page = read_dir_sync(root)
    .map(owner => join(root, owner, `${site}.html`))
    .find(path => exists_sync(path))
  if (!page) return null
  const html = read_file_sync(page, 'utf8')
  const cookies = [...html.matchAll(/<article[\s\S]*?<\/article>/g)].map(
    ([item]) => {
      const field = name =>
        unescape(
          item.match(new RegExp(`itemprop="${name}">([^<]*)<`))?.[1] ?? ''
        )
      return { name: field('name'), value: field('value') }
    }
  )
  return cookies.length ? cookies : null
}

/** Where a box mounts its owner's vault. Overridable so a spec can point at its own. */
export const vault_root = () => process.env.REALNESS_VAULT ?? '/realness/vault'

const FENCE = /^```js scout ([a-z0-9-]{1,40}) (\S+)\n([\s\S]*?)^```$/gm
const SOURCES = /^Sources.*\.md$/
const PLAN_DEPTH = 2

/**
 * @typedef {object} ScoutCode
 * @property {string} site the cookie jar it reads with
 * @property {string} host the host it answers for
 * @property {string} code the module text
 */

/** @returns {ScoutCode[]} */
export const scout_codes = markdown =>
  [...String(markdown ?? '').matchAll(FENCE)].map(([, site, host, code]) => ({
    site,
    host,
    code
  }))

/** Every `Sources*.md` in a plan folder, or a plan inside one. */
const sources_files = (dir, depth = PLAN_DEPTH) => {
  if (!exists_sync(dir)) return []
  return read_dir_sync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isFile() && SOURCES.test(entry.name)) return [path]
    if (entry.isDirectory() && depth > 0) return sources_files(path, depth - 1)
    return []
  })
}

/**
 * The scout code for a site, or for a URL's host when no site is named.
 * @param {{ site?: string | null, host: string }} wanted
 * @param {string} [root]
 * @returns {ScoutCode | null}
 */
export const find_scout_code = ({ site, host }, root = vault_root()) =>
  sources_files(join(root, 'Projects'))
    .flatMap(file => scout_codes(read_file_sync(file, 'utf8')))
    .find(found => (site ? found.site === site : found.host === host)) ?? null

/**
 * Run one block's `read` as a module.
 * @param {ScoutCode} scout
 * @param {string} url
 * @param {{ cookies: { name: string, value: string }[], fetcher?: typeof fetch, brief?: boolean }} tools
 * @returns {Promise<{ status: number, html: string }>}
 */
export const run_scout_code = async (
  { code },
  url,
  { fetcher = fetch, ...tools }
) => {
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  )
  return module.read(url, { fetcher, ...tools })
}

/**
 * Read one page with scout code: the site's cookies from the door, then the
 * block, which reads with them.
 * @param {ScoutCode} scout
 * @param {string} url
 * @param {{ ask: (request: Record<string, unknown>, options?: { timeout_ms?: number }) => Promise<Record<string, any>>, brief?: boolean, fetcher?: typeof fetch, saved?: { name: string, value: string }[] | null }} tools
 */
export const scout_read = async (
  scout,
  url,
  { ask, brief = false, fetcher = fetch, saved = box_cookies(scout.site) }
) => {
  const cookies = saved ?? (await login_of(scout.site, ask))
  if (!cookies.length) throw new Error(`no saved ${scout.site} login`)
  return run_scout_code(scout, url, { cookies, fetcher, brief })
}
