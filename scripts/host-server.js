/** @typedef {import('../src/types.js').Id} Id */
/** @typedef {import('../src/types.js').Type} Type */
/** @typedef {import('../src/types.js').Created} Created */
/** @typedef {import('../src/types.js').Author} Author */
/** @typedef {import('../src/types.js').Item} Item */

import {
  readFile,
  writeFile,
  mkdir,
  stat,
  readdir,
  unlink
} from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { gzip, inflate } from 'node:zlib'
import { promisify } from 'node:util'
import { has_archive, has_history, types } from '../src/types.js'

const gzip_async = promisify(gzip)
const inflate_async = promisify(inflate)

const STORAGE_PATH = process.env.STORAGE_PATH || './storage'
const PEOPLE_PATH = join(STORAGE_PATH, 'compressed')

/**
 * Splits an item ID path into its constituent parts
 * @param {Id} itemid - The full item path (e.g. '/+123456/statements/789')
 * @returns {[Author] | [Author, Type] | [Author, Type, Created]} Array of path parts where:
 *   [0] = author ID (e.g. '+123456')
 *   [1] = item type (e.g. 'statements', 'events', 'posters', etc.)
 *   [2] = created_at timestamp (if applicable)
 */
const as_path_parts = itemid => {
  const path = itemid.split('/')
  if (path[0].length === 0) path.shift()
  if (itemid.endsWith('/')) {
    //is a directory
    const [author, type, created = null, archive = null] = path
    if (!created && !archive) return [author, type, 'index', null]
    if (created) return [author, type, null, created]
  }
  return path
}

/**
 * @param {Id} itemid
 * @returns {Type | null}
 */
const as_type = itemid => {
  const path = as_path_parts(itemid)
  if (path[1]) return path[1]
  if (itemid.startsWith('/+')) return 'person'
  return null
}

/**
 * @param {Id} itemid
 * @returns {boolean}
 */
const is_history = itemid => {
  const parts = as_path_parts(itemid)
  if (has_history.includes(as_type(itemid)) && parts.length === 3) return true
  return false
}

/**
 * @param {Id} itemid
 * @returns {Promise<string>}
 */
const as_filename = async itemid => {
  let filename = itemid
  if (itemid.startsWith('/+')) filename = `people${itemid}`

  if (has_archive.includes(as_type(itemid))) {
    // For server version, we'll just return the filename without archive logic
    return `${filename}.html.gz`
  } else if (is_history(itemid)) return `${filename}.html.gz`

  return `${filename}/index.html.gz`
}

/**
 * @param {string} path
 * @returns {Promise<string>}
 */
const ensure_dir = async path => {
  try {
    await mkdir(path, { recursive: true })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  return path
}

/**
 * @param {Id} itemid
 * @returns {Promise<string>}
 */
export const location = async itemid => {
  const filename = await as_filename(itemid)
  return join(PEOPLE_PATH, filename)
}

/**
 * @param {Id} itemid
 * @returns {Promise<Object | null>}
 */
export const metadata = async itemid => {
  try {
    const file_path = await location(itemid)
    const stats = await stat(file_path)
    return {
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      contentType: 'text/html',
      contentEncoding: 'gzip'
    }
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

/**
 * @param {Id} itemid
 * @param {string | Buffer} data
 * @param {Object} _meta
 * @returns {Promise<void>}
 */
export const upload = async (itemid, data, _meta = {}) => {
  const file_path = await location(itemid)
  await ensure_dir(dirname(file_path))

  let content = data
  if (typeof content === 'string') content = Buffer.from(content, 'utf-8')

  // Always gzip the content
  const compressed = await gzip_async(content)
  await writeFile(file_path, compressed)
}

/**
 * @param {Id} itemid
 * @returns {Promise<string | null>}
 */
export const url = async itemid => {
  const file_path = await location(itemid)
  try {
    await stat(file_path)
    return `http://localhost:${process.env.LOCAL_SERVER_PORT || 3000}/api/${itemid}` // eslint-disable-line no-magic-numbers
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

/**
 * @param {Id} itemid
 * @returns {Promise<Object | null>}
 */
export const directory = async itemid => {
  // Handle root directory case
  if (!itemid || itemid === '/') {
    try {
      const entries = await readdir(PEOPLE_PATH, { withFileTypes: true })
      const items = []
      const prefixes = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // For root directory, show people directories
          items.push({ name: entry.name })
        }
      }

      return { items, prefixes }
    } catch (error) {
      if (error.code === 'ENOENT') return { items: [], prefixes: [] }
      throw error
    }
  }

  const [author, type, _created = null, archive = null] = as_path_parts(itemid)
  let dir_path = join(PEOPLE_PATH, author, type)

  if (archive) dir_path = join(dir_path, archive)

  try {
    const entries = await readdir(dir_path, { withFileTypes: true })
    const items = []
    const prefixes = []

    for (const entry of entries)
      if (entry.isDirectory()) prefixes.push({ name: entry.name })
      else if (entry.isFile() && entry.name.endsWith('.html.gz')) {
        const item_id = entry.name.replace('.html.gz', '')
        items.push({ name: item_id })
      }

    return { items, prefixes }
  } catch (error) {
    if (error.code === 'ENOENT') return { items: [], prefixes: [] }
    throw error
  }
}

/**
 * @param {Id} itemid
 * @returns {Promise<void>}
 */
export const remove = async itemid => {
  try {
    const file_path = await location(itemid)
    await unlink(file_path)
  } catch (error) {
    if (error.code === 'ENOENT') console.warn(itemid, 'already deleted')
    else throw error
  }
}

/**
 * @param {Type} type
 * @param {Id} id
 * @param {Created} archive_id
 * @returns {Promise<boolean>}
 */
export const move = async (type, id, archive_id) => {
  let upload_successful = false
  const old_location = id
  const new_location = `/${as_path_parts(id)[0]}/${type}/${archive_id}/${id.split('/').pop()}`

  try {
    // Read old file
    const old_path = await location(old_location)
    const compressed_data = await readFile(old_path)
    const html_data = await inflate_async(compressed_data)

    // Upload to new location
    await upload(/** @type {Id} */ (new_location), html_data)
    upload_successful = true

    // Remove old file
    await remove(old_location)
    console.info(`Moved ${old_location} to ${new_location}`)
    return true
  } catch (error) {
    // Cleanup if upload succeeded but remove failed
    if (upload_successful)
      try {
        await remove(/** @type {Id} */ (new_location))
        console.info(`Rolled back upload of ${new_location}`)
      } catch (cleanup_error) {
        console.error(`Failed to cleanup ${new_location}`, cleanup_error)
      }

    console.error(`Failed to move ${old_location}`, error)
    return false
  }
}

/**
 * @param {Id} itemid
 * @returns {Promise<string | null>}
 */
export const load_item = async itemid => {
  try {
    const file_path = await location(itemid)
    const compressed_data = await readFile(file_path)
    const html_data = await inflate_async(compressed_data)
    return html_data.toString('utf-8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

/**
 * @param {Id} itemid
 * @returns {Promise<string | null>}
 */
export const load_html = async itemid => {
  try {
    const file_path = await location(itemid)
    const compressed_data = await readFile(file_path)
    const html_data = await inflate_async(compressed_data)
    return html_data.toString('utf-8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
