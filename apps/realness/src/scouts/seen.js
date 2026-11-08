import {
  mkdir,
  readFile as read_file,
  rename,
  writeFile as write_file
} from 'node:fs/promises'
import { dirname } from 'node:path'
import { escape, item_html, read_items } from '#root/lib/items.js'
import { key_of } from './leads.js'

/** An ISO date is the first ten characters of the full stamp. */
const DATE_LENGTH = 10

/** @typedef {import('./leads.js').Lead} Lead */

/**
 * One find on the scout's page: the seen store and the status Scott edits.
 * @typedef {Record<string, string>} Find
 */

/**
 * Every find this scout has reported, oldest first. A missing page is a scout
 * that has not run yet.
 * @param {string} path
 * @returns {Promise<Find[]>}
 */
export const load_finds = async path => {
  const html = await read_file(path, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  return read_items(html, 'find')
}

/** The leads not on the page, and the ones that repeat it. */
export const split_fresh = (finds, leads) => {
  const known = new Set(finds.map(find => key_of(find.url)))
  return {
    fresh: leads.filter(lead => !known.has(key_of(lead.url))),
    repeats: leads.filter(lead => known.has(key_of(lead.url)))
  }
}

/**
 * The page after this run: every find before, untouched, then each fresh lead
 * as a `new` find under its own itemid.
 * @param {Find[]} finds
 * @param {Lead[]} fresh
 * @param {{ person: string, now: number }} at
 * @returns {Find[]}
 */
export const with_finds = (finds, fresh, { person, now }) => [
  ...finds,
  ...fresh.map((lead, index) => ({
    itemid: `${person}/finds/${now + index}`,
    url: lead.url,
    title: lead.title,
    org: lead.org,
    source: lead.source,
    score: String(lead.score),
    reason: lead.reason,
    node: lead.node,
    found: new Date(now).toISOString().slice(0, DATE_LENGTH),
    status: 'new'
  }))
]

/** The finds page: a titled document of `/find` items. */
export const finds_page = (label, finds) =>
  `<!doctype html>\n<title>${escape(label)} finds</title>\n${finds
    .map(find => item_html('find', find, { links: ['url'] }))
    .join('')}`

/** Written whole, then moved into place, so a crash never leaves half a page. */
export const save_finds = async (path, label, finds) => {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await write_file(tmp, finds_page(label, finds))
  await rename(tmp, path)
}
