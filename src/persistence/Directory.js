/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */

import {
  as_path_parts,
  as_author,
  as_type,
  as_created_at,
  is_itemid
} from '@/utils/itemid-parse'
import { get, set, keys } from 'idb-keyval'

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
  if (typeof str !== 'string' || !str.endsWith('/')) return false
  const base_id = str.slice(0, -1)
  if (!is_itemid(base_id)) return false
  return true
}

/**
 * @param {Id} itemid
 * @returns {string}
 */
export const as_directory_id = itemid => {
  const parts = as_path_parts(itemid)
  const [author, type, , archive] = parts
  if (archive && archive !== 'index') return `/${author}/${type}/${archive}/`
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
 * @returns {boolean}
 */
const is_admin_directory = itemid => {
  const admin_id = import.meta.env.VITE_ADMIN_ID
  if (!admin_id) return false
  const [author] = as_path_parts(itemid)
  return !!(author && `/${author}` === admin_id)
}

export const load_directory_from_network = async itemid => {
  if (itemid.startsWith('/+/')) return null
  if (!navigator.onLine) return null
  const { directory: firebase_directory, current_user } =
    await import('@/utils/serverless')
  if (!current_user.value && !is_admin_directory(itemid)) return null

  const [author, type, , archive = null] = as_path_parts(itemid)
  const path = as_directory_id(itemid)
  const meta = new Directory(/** @type {Id} */ (path))

  let firebase_path = `people/${author}/${type}/`
  if (archive) firebase_path += `${archive}/`
  const folder = await firebase_directory(firebase_path)
  const seen_timestamps = new Set()
  folder?.items?.forEach(item => {
    const [filename] = item.name.split('.')
    if (type === 'posters' && filename.includes('-')) return
    const timestamp = parseInt(filename)
    if (!seen_timestamps.has(timestamp)) {
      seen_timestamps.add(timestamp)
      meta.items.push(timestamp)
    }
  })
  folder?.prefixes?.forEach(prefix => meta.archive.push(parseInt(prefix.name)))
  await set(path, meta)
  return meta
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const as_directory = async itemid => {
  const { current_user } = await import('@/utils/serverless')
  const path = as_directory_id(itemid)
  const cached = await get(path)
  if (cached) {
    const local_directory = await build_local_directory(itemid)
    const local_items = local_directory?.items ?? []
    const cached_items = cached.items || []
    const merged_items = [...new Set([...cached_items, ...local_items])]
    if (merged_items.length !== cached_items.length)
      return { ...cached, items: merged_items }
    return cached
  }

  let directory = await build_local_directory(itemid)
  const may_fetch_network =
    navigator.onLine && (current_user.value || is_admin_directory(itemid))
  if (may_fetch_network)
    try {
      directory = await load_directory_from_network(itemid)
    } catch (e) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        e.code === 'storage/unauthorized'
      )
        return directory
      throw e
    }

  return directory
}

/**
 * Resolve Firebase Storage path for an item under an archive directory.
 * Lives here so it can call `as_directory` without `@/utils/itemid` importing this module.
 * @param {Id} itemid
 * @returns {Promise<string | null>}
 */
export const as_archive = async itemid => {
  if (itemid.startsWith('/+/')) return null
  const directory = await as_directory(itemid)
  if (!directory) return null

  const { items = [], archive = [] } = directory
  const created = as_created_at(itemid)
  if (!created) return null

  if (items.length === 0) return null

  const item_timestamps = items.map(Number)
  if (item_timestamps.length > 0 && created > Math.max(...item_timestamps))
    return null

  if (item_timestamps.includes(created)) return null

  if (archive.includes(created))
    return `people${as_author(itemid)}/${as_type(itemid)}/${created}/${created}`

  let closest_timestamp = null
  for (const archive_id of archive)
    if (archive_id <= created) closest_timestamp = archive_id

  if (!closest_timestamp) return null
  return `people${as_author(itemid)}/${as_type(itemid)}/${closest_timestamp}/${created}`
}
