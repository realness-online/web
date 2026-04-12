/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */
/** @typedef {import('@/types').Author} Author */
/** @typedef {import('@/types').Item} Item */
import { has_archive, has_history } from '@/types.js'

import {
  as_path_parts,
  as_author,
  as_type,
  as_created_at,
  is_itemid
} from './itemid-parse.js'
import { get, set, del } from 'idb-keyval'
import { DOES_NOT_EXIST } from '@/utils/sync-file'
import { decompress_html } from '@/utils/upload-processor'

export { as_path_parts, as_author, as_type, as_created_at, is_itemid }

/** @type {Map<string, Promise<string | null>>} */
const download_url_inflight = new Map()

/**
 * Lazy-load HTML parser to avoid a static cycle with `@/utils/item` (which imports `itemid`).
 * @param {string} html
 * @param {Id} itemid
 * @returns {Promise<import('@/types').Item | null>}
 */
const item_from_html = async (html, itemid) => {
  const { default: get_item } = await import('@/utils/item')
  return get_item(html, itemid)
}

/**
 * Signed-in profile id (`setItem('me', …)` and `localStorage.me` both set this).
 * @returns {Author | undefined}
 */
const storage_me = () => {
  if (typeof localStorage === 'undefined') return undefined
  return localStorage.getItem('me') ?? localStorage.me ?? undefined
}

/**
 * @param {Id} itemid
 * @returns {Promise<string>}
 */
export const as_filename = async itemid => {
  const { as_archive } = await import('@/persistence/Directory')
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
  else if (item_type === 'relations') {
    const base = filename.replace(/\/relations$/, '')
    return `${base}/relations.html.gz`
  }

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
    if (!response.ok) return null

    const content_encoding = response.headers.get('Content-Encoding')
    const compressed_html = await response.arrayBuffer()
    let html = null
    if (!content_encoding || content_encoding === 'identity')
      html = new TextDecoder().decode(compressed_html)
    else html = await decompress_html(compressed_html)

    if (!html) return null
    if (typeof localStorage !== 'undefined' && itemid === storage_me()) {
      localStorage.setItem(itemid, html)
      await del(itemid)
    } else await set(itemid, html)
    return item_from_html(html, itemid)
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
    if (!response.ok) return { item: null, html: null }

    const content_encoding = response.headers.get('Content-Encoding')
    const compressed_html = await response.arrayBuffer()
    let html = null
    if (!content_encoding || content_encoding === 'identity')
      html = new TextDecoder().decode(compressed_html)
    else html = await decompress_html(compressed_html)

    if (!html) return { item: null, html: null }
    const item = await item_from_html(html, itemid)
    return { item, html }
  }
  return { item: null, html: null }
}

/**
 * @param {Id} itemid
 * @param {Author} [me]
 * @returns {Promise<Item | null>}
 */
export const load = async (itemid, me = storage_me()) => {
  let item
  if (me && ~itemid.indexOf(me)) {
    const item_html = localStorage.getItem(itemid)
    if (item_html) return item_from_html(item_html, itemid)
  }
  if (itemid === me && typeof localStorage !== 'undefined') {
    const legacy_html = await get(itemid)
    if (typeof legacy_html === 'string' && legacy_html.length) {
      item = await item_from_html(legacy_html, itemid)
      if (item) {
        localStorage.setItem(itemid, legacy_html)
        await del(itemid)
        return item
      }
    }
  }
  if (itemid !== me) {
    const result = await get(itemid)
    item = await item_from_html(result, itemid)
    if (item) return item
  }
  try {
    item = await load_from_network(itemid)
  } catch (e) {
    if (
      e &&
      typeof e === 'object' &&
      'code' in e &&
      /** @type {{code?: string}} */ (e).code === 'storage/unauthorized'
    )
      return null
    throw e
  }
  if (item) return item
  return null
}

/**
 * @param {Id} itemid
 * @param {Author} [me]
 * @returns {Promise<Item[]>}
 */
export const list = async (itemid, me = storage_me()) => {
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
  if (String(itemid) === '/+' || itemid.startsWith('/+/')) return null
  const index = (await get('sync:index')) || {}
  if (index[itemid] === DOES_NOT_EXIST) return null

  const key = String(itemid)
  const existing = download_url_inflight.get(key)
  if (existing) return existing

  const pending = (async () => {
    try {
      const idx = (await get('sync:index')) || {}
      if (idx[itemid] === DOES_NOT_EXIST) return null
      const { url } = await import('@/utils/serverless')
      return await url(await as_filename(itemid))
    } catch (e) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        e.code === 'storage/object-not-found'
      ) {
        const idx = (await get('sync:index')) || {}
        idx[itemid] = DOES_NOT_EXIST
        await set('sync:index', idx)
        return null
      }
      throw e
    } finally {
      download_url_inflight.delete(key)
    }
  })()

  download_url_inflight.set(key, pending)
  return pending
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
 * @param {Item | null | undefined} item
 * @returns {Item[]}
 */
export const type_as_list = item => {
  if (!item) return []
  const type = as_type(item.id)
  if (!type) return []
  let list = /** @type {Record<string, unknown>} */ (item)[type]
  if (!list && type === 'thoughts')
    list = /** @type {Record<string, unknown>} */ (item).statements
  if (list && Array.isArray(list)) return list
  if (list) {
    const as_item = /** @type {Item} */ (list)
    return [as_item]
  }
  return []
}
/**
 * @param {Id} itemid
 * @returns {boolean}
 */
const is_history = itemid => {
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
