/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */
/** @typedef {import('@/types').Author} Author */
/** @typedef {import('@/types').Item} Item */
import { has_archive, has_history, types } from '@/types.js'

import { get, set } from 'idb-keyval'
import get_item from '@/utils/item'
import { DOES_NOT_EXIST } from '@/use/sync'
import { url } from '@/utils/serverless'
import { decompress_html } from '@/utils/upload-processor'
import { as_directory } from '@/persistance/Directory'

/**
 * @param {Id} itemid
 * @returns {Promise<string>}
 */
export const as_filename = async itemid => {
  const poster_id = as_poster_id(itemid)
  if (poster_id) {
    let poster_filename = poster_id
    if (poster_id.startsWith('/+')) poster_filename = `people${poster_id}`

    const layer_name = as_layer_name(itemid)
    const archive = await as_archive(poster_id)

    if (archive) {
      const suffix = layer_name ? `-${layer_name}` : ''
      return `${archive}${suffix}.html.gz`
    }

    const suffix = layer_name ? `-${layer_name}` : ''
    return `${poster_filename}${suffix}.html.gz`
  }

  let filename = itemid
  if (itemid.startsWith('/+')) filename = `people${itemid}`

  const item_type = as_type(itemid)
  if (
    item_type &&
    has_archive.includes(/** @type {typeof has_archive[number]} */ (item_type))
  ) {
    const archive = await as_archive(itemid)
    if (archive) return `${archive}.html.gz`
    return `${filename}.html.gz`
  } else if (is_history(itemid)) return `${filename}.html.gz`

  return `${filename}/index.html.gz`
}

/**
 * @param {Id} itemid
 * @returns {Promise<Item | null>}
 */
export const load_from_network = async itemid => {
  const url = await as_download_url(itemid)

  if (url) {
    const response = await fetch(url)

    // Check Content-Encoding header
    const content_encoding = response.headers.get('Content-Encoding')
    const compressed_html = await response.arrayBuffer()
    let html = null
    // If no content encoding or 'identity', data is already decompressed
    if (!content_encoding || content_encoding === 'identity')
      html = new TextDecoder().decode(compressed_html)
    else html = await decompress_html(compressed_html)

    if (!html) return null
    await set(itemid, html)
    return get_item(html, itemid)
  }
  return null
}

/**
 * Loads from network HTTP cache without storing to IndexedDB
 * Used for shadow/cutout types that should rely on HTTP cache when online/signed in
 * @param {Id} itemid
 * @returns {Promise<{item: Item | null, html: string | null}>}
 */
export const load_from_cache = async itemid => {
  const url = await as_download_url(itemid)

  if (url) {
    const response = await fetch(url)

    // Check Content-Encoding header
    const content_encoding = response.headers.get('Content-Encoding')
    const compressed_html = await response.arrayBuffer()
    let html = null
    // If no content encoding or 'identity', data is already decompressed
    if (!content_encoding || content_encoding === 'identity')
      html = new TextDecoder().decode(compressed_html)
    else html = await decompress_html(compressed_html)

    if (!html) return { item: null, html: null }
    const item = get_item(html, itemid)
    return { item, html }
  }
  return { item: null, html: null }
}

/**
 * @param {Id} itemid
 * @param {Author} me
 * @returns {Promise<Item | null>}
 */
export const load = async (itemid, me = localStorage.me) => {
  let item
  if (~itemid.indexOf(me)) {
    const item_html = localStorage.getItem(itemid)
    if (item_html) return get_item(item_html, itemid)
    else if (as_type(itemid) === 'relations') return null
  }
  const result = await get(itemid)
  item = get_item(result, itemid)
  if (item) return item
  try {
    item = await load_from_network(itemid)
  } catch (e) {
    if (e.code === 'storage/unauthorized') return null
    throw e
  }
  if (item) return item
  return null
}

/**
 * @param {Id} itemid
 * @param {Author} me
 * @returns {Promise<Item[]>}
 */
export const list = async (itemid, me = localStorage.me) => {
  try {
    const item = await load(itemid, me)
    if (item) return type_as_list(item)
    return []
  } catch {
    return []
  }
}

/**
 * @param {Id} itemid
 * @returns {Promise<string | null>}
 */
export const as_download_url = async itemid => {
  if (itemid.startsWith('/+/')) return null
  const index = (await get('sync:index')) || {}
  if (index[itemid] === DOES_NOT_EXIST) return null
  try {
    return await url(await as_filename(itemid))
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(itemid, '=>', await as_filename(itemid))
      index[itemid] = DOES_NOT_EXIST
      await set('sync:index', index)
      return null
    }
    throw e
  }
}

/**
 * Splits an item ID path into its constituent parts
 * @param {Id} itemid - The full item path (e.g. '/+123456/statements/789')
 * @returns {string[]} Array of path parts where:
 *   [0] = author ID (e.g. '+123456')
 *   [1] = item type (e.g. 'statements', 'events', 'posters', etc.)
 *   [2] = created_at timestamp (if applicable)
 * @example
 * as_path_parts('/+123456/statements/789') // ['+123456', 'statements', '789']
 * as_path_parts('/+123456') // ['+123456']
 * as_path_parts('/+123456/statements/789/') // ['+123456', 'statements', null, '789']
 */
export const as_path_parts = itemid => {
  if (!itemid || typeof itemid !== 'string') return []
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
 * @returns {string | null}
 */
export const as_storage_path = itemid => {
  const path_parts = as_path_parts(itemid)
  let path = `/${path_parts[0]}`
  if (itemid.startsWith('/+')) path = `/people${path}`
  switch (path_parts.length) {
    case 0:
      return null
    case 1:
      return path
    default:
      return `${path}/${path_parts[1]}`
  }
}

/**
 * @param {Id} itemid
 * @returns {string | null}
 */
export const as_author = itemid => {
  const path = as_path_parts(itemid)
  const author = path[0] || ''
  if (author.startsWith('+1')) return `/${path[0]}` // TODO this does not work for internaional phone numbers
  return null
}

/**
 * @param {Id} itemid
 * @returns {Type | null}
 */
export const as_type = itemid => {
  const path = as_path_parts(itemid)
  if (path[1] && types.includes(/** @type {Type} */ (path[1])))
    return /** @type {Type} */ (path[1])
  if (itemid.startsWith('/+')) return 'person'
  return null
}

/**
 * @param {Id} itemid
 * @returns {Created | null}
 */
export const as_created_at = itemid => {
  const path = as_path_parts(itemid)
  const path_length = path.length
  const PATH_WITH_TYPE = 3
  const PATH_WITH_TYPE_AND_CREATED = 4
  if (path_length === PATH_WITH_TYPE && path[2])
    return /** @type {Created} */ (parseInt(path[2]))
  if (path_length === PATH_WITH_TYPE_AND_CREATED && path[3])
    return /** @type {Created} */ (parseInt(path[3]))
  return null
}

/**
 * @param {Id} itemid
 * @returns {string}
 */
export const as_query_id = itemid =>
  itemid.substring(2).replace('/', '-').replace('/', '-')
//

/**
 * @param {Id} itemid
 * @returns {string}
 */
export const as_fragment_id = itemid => `#${as_query_id(itemid)}`

/**
 * @param {Item} item
 * @returns {Item[]}
 */
export const type_as_list = item => {
  // Returns a list even if loading the item fails
  // the microdata spec requires properties values to
  // single value and iterable
  if (!item) return []
  const list = item[as_type(item.id)]
  if (list && Array.isArray(list)) return list
  else if (list) return [list]
  return []
}
/**
 * @param {Id} itemid
 * @returns {boolean}
 */
export const is_history = itemid => {
  const parts = as_path_parts(itemid)
  const item_type = as_type(itemid)
  if (
    item_type &&
    has_history.includes(
      /** @type {typeof has_history[number]} */ (item_type)
    ) &&
    parts.length === 3
  )
    return true
  return false
}

/**
 * Determines if an item needs to be loaded from an archive
 * @param {Id} itemid - The ID of the item to check
 * @returns {Promise<string | null>} - Returns null if the item exists in the main items list,
 *                                    otherwise returns the archive path if found in an archive,
 *                                    or null if not found in either location
 */
export const as_archive = async itemid => {
  const directory = await as_directory(itemid)
  if (!directory) return null

  const { items = [], archive = [] } = directory
  const created = as_created_at(itemid)
  if (!created) return null

  // If items list is empty, poster belongs in root directory
  if (items.length === 0) return null

  // If the item is newer than any current items, it belongs in root directory
  // This handles the case where layers are saved before the poster is added to directory
  const item_timestamps = items.map(Number)
  if (item_timestamps.length > 0 && created > Math.max(...item_timestamps))
    return null

  // If the item is already in the items list, it's a new poster and belongs in root directory
  if (item_timestamps.includes(created)) return null

  // If the item is an archive timestamp itself, return its own path
  if (archive.includes(created))
    return `people${as_author(itemid)}/${as_type(itemid)}/${created}/${created}`

  // Find the appropriate archive for older items
  // Only archive if there are enough items to warrant archiving
  let closest_timestamp = null
  for (const archive_id of archive)
    if (archive_id <= created) closest_timestamp = archive_id

  if (!closest_timestamp) return null
  return `people${as_author(itemid)}/${as_type(itemid)}/${closest_timestamp}/${created}`
}

/**
 * Validates if a string matches the Id type pattern: ${Author}/${Type} or ${Author}/${Type}/${Created}
 * @param {string} id - String to validate
 * @returns {id is Id} - True if string matches Id pattern
 */
export const is_itemid = id => {
  if (typeof id !== 'string') return false

  // Ensure id starts with a forward slash
  if (!id.startsWith('/')) return false

  const parts = as_path_parts(/** @type {Id} */ (id))
  if (parts.length < 2 || parts.length > 3) return false

  const [author, type, created] = parts

  // Validate author (must start with '+')
  if (!author.startsWith('+')) return false

  // Validate type against the Type typedef from types.js
  if (!types.includes(/** @type {Type} */ (type))) return false

  // Large files require timestamps
  const requires_timestamp = ['posters']
  if (requires_timestamp.includes(type)) {
    if (!created) return false
    const created_num = Number(created)
    if (!Number.isInteger(created_num)) return false
  }

  return true
}

/**
 * Constructs a layer ID (shadow or cutout) from a poster ID
 * @param {Id} poster_id - Poster itemid (e.g., '/+123456/posters/789')
 * @param {string} layer - Layer name ('shadows', 'sediment', 'sand', 'gravel', 'rocks', 'boulders')
 * @returns {Id} Layer itemid (e.g., '/+123456/shadows/789')
 */
export const as_layer_id = (poster_id, layer) => {
  if (!poster_id || typeof poster_id !== 'string') return /** @type {Id} */ ('')
  const path = as_path_parts(poster_id)
  const [author, , created] = path
  if (!author || !created) return /** @type {Id} */ ('')
  return /** @type {Id} */ (`/${author}/${layer}/${created}`)
}

/**
 * Gets the poster ID from a layer ID (reverse of as_layer_id)
 * @param {Id} layer_id - Layer itemid (e.g., '/+123456/shadows/789')
 * @returns {Id | null} Poster itemid (e.g., '/+123456/posters/789') or null if not a layer
 */
export const as_poster_id = layer_id => {
  if (!layer_id || typeof layer_id !== 'string') return null
  const path = as_path_parts(layer_id)
  const [author, type, created] = path
  if (!author || !created) return null

  const layer_types = [
    'shadows',
    'sediment',
    'sand',
    'gravel',
    'rocks',
    'boulders'
  ]
  if (!layer_types.includes(type)) return null

  return /** @type {Id} */ (`/${author}/posters/${created}`)
}

/**
 * Gets the layer name from a layer ID
 * @param {Id} layer_id - Layer itemid (e.g., '/+123456/shadows/789')
 * @returns {string | null} Layer name ('shadows', 'sediment', etc.) or null
 */
export const as_layer_name = layer_id => {
  if (!layer_id || typeof layer_id !== 'string') return null
  const path = as_path_parts(layer_id)
  const [, type] = path
  if (!type) return null

  const layer_types = [
    'shadows',
    'sediment',
    'sand',
    'gravel',
    'rocks',
    'boulders'
  ]
  if (!layer_types.includes(type)) return null

  return type
}
