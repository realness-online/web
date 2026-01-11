/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */

import { as_path_parts, as_created_at, is_itemid } from '@/utils/itemid'
import { get, set, keys } from 'idb-keyval'
import { directory, current_user } from '@/utils/serverless'

/**
 * @implements {Directory}
 */
class Directory {
  id = /** @type {Id} */ ('')

  /**
   * @type {Type[]}
   */
  types = [] // at the root of the directory folders are types in our vocabulary

  /**
   * @type {Created[]}
   */
  archive = []

  /**
   * @type {Created[]}
   */
  items = []

  /**
   * @param {Id} id
   */
  constructor(id) {
    this.id = /** @type {Id} */ (as_directory_id(id))
  }
}

/**
 * Validates if a string is a directory id
 * @param {string} str - String to validate
 * @returns {boolean} - True if string matches directory id pattern
 */
export const is_directory_id = str => {
  // Early return if not a string or doesn't end with slash
  if (typeof str !== 'string' || !str.endsWith('/')) return false

  // Remove trailing slash and validate as itemid
  const base_id = str.slice(0, -1)
  if (!is_itemid(base_id)) return false

  return true
}

/**
 * @param {unknown} maybe
 * @returns {maybe is Directory}
 */
export const is_directory = maybe =>
  Boolean(maybe) &&
  typeof maybe === 'object' &&
  'id' in maybe &&
  'types' in maybe &&
  'archive' in maybe &&
  'items' in maybe
//

/**
 * @param {Id} itemid
 * @returns {string}
 */
export const as_directory_id = itemid => {
  const parts = as_path_parts(itemid)
  const [author, type, , archive] = parts

  // Archive is only valid if it's a numeric timestamp, not 'index'
  if (archive && archive !== 'index') return `/${author}/${type}/${archive}/`
  // For root directories (no archive or 'index'), always use /author/type/ format
  // This normalizes both "/author/type/" and "/author/type/itemid" to the same directory
  return `/${author}/${type}/`
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const build_local_directory = async itemid => {
  const path = /** @type {Id} */ (as_directory_id(itemid))
  const directory = new Directory(path)
  const everything = await keys()
  everything?.forEach(itemid => {
    if (as_directory_id(/** @type {Id} */ (itemid)) === path) {
      const id = as_created_at(/** @type {Id} */ (itemid))
      if (id) directory.items.push(id)
    }
  })
  return directory
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const load_directory_from_network = async itemid => {
  if (navigator.onLine && current_user.value) {
    const [author, type, , archive = null] = as_path_parts(itemid)

    const path = as_directory_id(itemid)

    const meta = new Directory(/** @type {Id} */ (path))

    let firebase_path = `people/${author}/${type}/`
    if (archive) firebase_path += `${archive}/`
    const folder = await directory(firebase_path)
    const seen_timestamps = new Set()
    folder?.items?.forEach(item => {
      const [filename] = item.name.split('.')
      // For posters directory, filter out layer files (they have -layer suffix)
      if (type === 'posters' && filename.includes('-')) return
      const timestamp = parseInt(filename)
      if (!seen_timestamps.has(timestamp)) {
        seen_timestamps.add(timestamp)
        meta.items.push(timestamp)
      }
    })
    folder?.prefixes?.forEach(prefix =>
      meta.archive.push(parseInt(prefix.name))
    )
    await set(path, meta)
    return meta
  }
  return null
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const as_directory = async itemid => {
  const path = as_directory_id(itemid)
  const cached = await get(path)
  if (cached) return cached

  let directory = await build_local_directory(itemid)
  if (navigator.onLine && current_user.value)
    try {
      directory = await load_directory_from_network(itemid)
    } catch (e) {
      if (e.code === 'storage/unauthorized') return directory
      throw e
    }

  return directory
}
