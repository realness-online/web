import {
  existsSync as exists_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { escape, item_html, read_items } from '#root/lib/items.js'

/** A plan can hold plans, and a scout sits beside the plan it watches. */
const DEPTH = 3

/**
 * One scout as its page says it: the plan folder it watches, and what it may
 * spend when it runs.
 * @typedef {object} Scout
 * @property {string} path the plan folder, relative to `Projects`
 * @property {string} folder the plan folder, absolute
 * @property {string} file the `scout.html` it was read from
 * @property {string} itemid
 * @property {string} org
 * @property {string} schedule
 * @property {number} minutes a run's deadline
 * @property {number} per_day runs a day
 * @property {string} status `active` or `paused`
 */

/** @param {string} value */
const number_of = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

/**
 * The one `/scout` item a page holds, or null when it holds none.
 * @param {string} html
 */
export const read_scout = html => read_items(html, 'scout')[0] ?? null

/**
 * Every scout page below a plans folder, sorted by its folder, so the runner
 * needs no list of names in code.
 * @param {string} dir
 * @param {string} base folder relative to the plans folder
 * @param {number} depth
 * @returns {Scout[]}
 */
const walk = (dir, base, depth) => {
  if (depth === 0) return []
  return readdir_sync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap(entry => {
      const folder = join(dir, entry.name)
      const path = base ? `${base}/${entry.name}` : entry.name
      const file = join(folder, 'scout.html')
      const found = exists_sync(file) ? [scout_of(file, folder, path)] : []
      return [...found, ...walk(folder, path, depth - 1)]
    })
}

/** @param {string} file @param {string} folder @param {string} path */
const scout_of = (file, folder, path) => {
  const item = read_scout(read_file_sync(file, 'utf8'))
  if (!item) throw new Error(`${file} holds no /scout item`)
  return {
    path,
    folder,
    file,
    itemid: item.itemid,
    org: item.org,
    schedule: item.schedule,
    minutes: number_of(item.minutes),
    per_day: number_of(item.per_day),
    status: item.status
  }
}

/**
 * The scouts a vault holds: one per `scout.html` below `Projects`.
 * @param {string} vault_dir
 * @returns {Scout[]}
 */
export const scout_pages = vault_dir =>
  walk(join(vault_dir, 'Projects'), '', DEPTH)

/** `Scouts/Realness`, `Scouts/Realness/`, or `Scouts/Realness/scout.html`. */
const plain = name =>
  String(name ?? '')
    .replace(/\/+$/, '')
    .replace(/\/scout\.html$/, '')

export const find_scout = (pages, name) => {
  const wanted = plain(name).toLowerCase()
  const named = pages.filter(
    page => page.path.split('/').at(-1)?.toLowerCase() === wanted
  )
  if (named.length > 1)
    throw new Error(
      `two scouts are named ${name}: ${named.map(page => page.path).join(', ')}`
    )
  const match =
    pages.find(page => page.path.toLowerCase() === wanted) ?? named[0]
  if (match) return match
  const found = pages.map(page => page.path).join(', ')
  throw new Error(
    found
      ? `no scout named ${name}: try ${found}`
      : 'the vault holds no scout.html'
  )
}

/**
 * One scout page's fields.
 * @typedef {object} ScoutFields
 * @property {string} itemid
 * @property {string} org
 * @property {string} schedule
 * @property {number|string} minutes
 * @property {number|string} per_day
 * @property {string} status
 */

/**
 * The one `/scout` item, as a page holds it.
 * @param {ScoutFields} fields
 */
export const scout_item = ({
  itemid,
  org,
  schedule,
  minutes,
  per_day,
  status
}) =>
  item_html('scout', {
    itemid,
    org,
    schedule,
    minutes: String(minutes),
    per_day: String(per_day),
    status
  })

/** @param {string} title @param {ScoutFields} fields */
export const scout_page = (title, fields) =>
  `<!doctype html>\n<title>${escape(title)} scout</title>\n${scout_item(fields)}`
