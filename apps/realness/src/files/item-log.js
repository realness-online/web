/**
 * An append-only page of items: `x.html.gz`, chained gzip members, one item
 * per append. The same shape a Pi session keeps, so a log a machine writes
 * reads back with `read_items` and packs to a fraction of its JSON.
 *
 *     await append_item(path, 'stage', { at, tool })
 *     const stages = await read_page(path, 'stage')
 */
import {
  appendFile as append_file,
  mkdir,
  readFile as read_file
} from 'node:fs/promises'
import { dirname } from 'node:path'
import { gunzipSync as gunzip_sync, gzipSync as gzip_sync } from 'node:zlib'
import { item_html, read_items } from '#root/lib/items.js'

/**
 * One item, written whole, as its own gzip member.
 * @param {string} path
 * @param {string} type
 * @param {Record<string, string | number>} fields
 */
export const append_item = async (path, type, fields) => {
  await mkdir(dirname(path), { recursive: true })
  const text = item_html(
    type,
    Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [name, String(value)])
    )
  )
  await append_file(path, gzip_sync(Buffer.from(text, 'utf8')))
}

/**
 * Every item on the page, oldest first. A missing page is an empty one.
 * @param {string} path
 * @param {string} type
 * @returns {Promise<Record<string, string>[]>}
 */
export const read_page = async (path, type) => {
  const packed = await read_file(path).catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!packed) return []
  return read_items(gunzip_sync(packed).toString('utf8'), type)
}
