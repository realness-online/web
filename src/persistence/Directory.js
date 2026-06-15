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
import { get, set, keys, del } from 'idb-keyval'
import { is_sync_index_missing } from '@/utils/sync-file'

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
 * Deletes cached `Directory` rows in idb for one author (folder listings under
 * `people/{author}/…`, stored as keys `${author_id}/type/…/`). Does not delete item HTML keys
 * (no trailing `/`). Uses prefix matching because `is_directory_id` does not treat type-root
 * paths like `/${author}/posters/` as directory ids (see tests).
 * @param {Id} author_id - Root person id (e.g. `/+1…`)
 * @returns {Promise<void>}
 */
export const clear_author_dirs = async author_id => {
  const prefix = `${author_id}/`
  const all_keys = await keys()
  const to_delete = []
  for (const key of all_keys ?? []) {
    if (typeof key !== 'string') continue
    if (!key.startsWith(prefix)) continue
    if (!key.endsWith('/')) continue
    to_delete.push(key)
  }
  await Promise.all(to_delete.map(key => del(key)))
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
  const raw = import.meta.env.VITE_ADMIN_ID
  if (!raw) return false
  const admin_id = `/${String(raw).replace(/^\/?/, '')}`
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
  if (archive)
    await remember_archive_locations(
      /** @type {Id} */ (path),
      parseInt(archive),
      meta.items
    )
  return meta
}

/**
 * idb key for the archive location map of an author+type:
 * `{ [created_at]: archive_id }`. Archive segments are location only —
 * identity stays the 3-part itemid.
 * @param {Id} itemid
 * @returns {string}
 */
const as_archive_map_id = itemid =>
  `${as_author(itemid)}/${as_type(itemid)}/archive-map/`

/**
 * Looks up which archive directory holds an item, if known.
 * @param {Id} itemid
 * @returns {Promise<Created | null>}
 */
export const lookup_archive = async itemid => {
  const created = as_created_at(itemid)
  if (!created) return null
  const map = await get(as_archive_map_id(itemid))
  return map?.[created] ?? null
}

/**
 * Records which archive directory each created_at lives in, and clears any
 * DOES_NOT_EXIST markers in `sync:index` for items proven to exist — a 404
 * from a mis-resolved storage path must not permanently block the item.
 * @param {Id} itemid - Any itemid under the author+type (archive dir id works)
 * @param {Created} archive_id
 * @param {Created[]} created_ats - Items discovered inside that archive
 * @returns {Promise<void>}
 */
export const remember_archive_locations = async (
  itemid,
  archive_id,
  created_ats
) => {
  if (!archive_id || !created_ats?.length) return
  const map_key = as_archive_map_id(itemid)
  const map = (await get(map_key)) || {}
  let changed = false
  created_ats.forEach(created => {
    if (map[created] === archive_id) return
    map[created] = archive_id
    changed = true
  })
  if (changed) await set(map_key, map)

  const index = await get('sync:index')
  if (!index) return
  let index_changed = false
  created_ats.forEach(created => {
    const id = `${as_author(itemid)}/${as_type(itemid)}/${created}`
    if (is_sync_index_missing(index[id])) {
      delete index[id]
      index_changed = true
    }
  })
  if (index_changed) await set('sync:index', index)
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
  const created = as_created_at(itemid)
  if (!created) return null
  const author = as_author(itemid)
  const type = as_type(itemid)

  const known_archive = await lookup_archive(itemid)
  if (known_archive)
    return `people${author}/${type}/${known_archive}/${created}`

  // Read the raw cached directory — `as_directory` merges locally cached item
  // keys into `items`, which makes an archived item with local html look like
  // it lives in the main directory and resolves to a 404ing storage path.
  const path = /** @type {Id} */ (as_directory_id(itemid))
  const directory = (await get(path)) ?? (await as_directory(itemid))
  if (!directory) return null

  const { items = [], archive = [] } = directory

  // If poster is in the main directory items, it's not archived
  const item_timestamps = items.map(Number)
  if (item_timestamps.includes(created)) return null

  // If items exist and poster is newer than all items, it doesn't exist yet
  if (item_timestamps.length > 0 && created > Math.max(...item_timestamps))
    return null

  return archive.reduce(async (chain, archive_id) => {
    const found = await chain
    if (found) return found
    const dir_path = `/${author?.slice(1)}/${type}/${archive_id}/`
    const dir = await as_directory(/** @type {Id} */ (dir_path))
    if (dir?.items?.map(Number).includes(created)) {
      await remember_archive_locations(
        /** @type {Id} */ (dir_path),
        archive_id,
        [created]
      )
      return `people${author}/${type}/${archive_id}/${created}`
    }
    return null
  }, Promise.resolve(null))
}
