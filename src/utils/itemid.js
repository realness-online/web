/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */
/** @typedef {import('@/types').Author} Author */
/** @typedef {import('@/types').Item} Item */
/** @typedef {import('@/types').Statements} Statements */
import { has_archive, has_history } from '@/types.js'

import {
  as_path_parts,
  as_author,
  as_type,
  as_created_at,
  is_itemid
} from './itemid-parse.js'
import { get, set, del } from 'idb-keyval'
import { DOES_NOT_EXIST, is_sync_index_missing } from '@/utils/sync-file'
import { decompress_html } from '@/utils/upload-processor'
import { mutex_for } from '@/utils/algorithms'

export { as_path_parts, as_author, as_type, as_created_at, is_itemid }

/**
 * Canonical itemid for a Thoughts day slot: one poster, or the first row of a statement train.
 *
 * @param {Item | Statements} slot
 * @returns {Id}
 */
export const feed_slot_itemid = slot =>
  Array.isArray(slot)
    ? /** @type {Id} */ (slot[0].id)
    : /** @type {Id} */ (slot.id)

/** @type {Map<string, Promise<string | null>>} */
const download_url_inflight = new Map()

/** idb key holding `{ [itemid]: { filename, url } }`. */
const DOWNLOAD_URLS = 'sync:urls'

/**
 * Entries kept in `sync:urls`. Every read deserializes the whole map, so this is a
 * ceiling on read cost as much as on disk. Posters store seven files apiece, so it
 * needs room for a feed's worth of layers.
 */
const DOWNLOAD_URL_LIMIT = 500

/**
 * A download URL only moves when the object is re-uploaded (new token) or archived
 * (new filename), so it is worth remembering: `getDownloadURL` is a round trip, and
 * the same one `getMetadata` makes.
 * @param {Id} itemid
 * @param {string} filename
 * @returns {Promise<string | null>}
 */
const cached_download_url = async (itemid, filename) => {
  const cache = (await get(DOWNLOAD_URLS)) || {}
  const entry = cache[itemid]
  if (entry?.filename !== filename) return null
  return typeof entry.url === 'string' ? entry.url : null
}

/**
 * @param {Id} itemid
 * @param {string} filename
 * @param {string} url
 * @returns {Promise<void>}
 */
const remember_download_url = async (itemid, filename, url) => {
  const urls_mutex = mutex_for(DOWNLOAD_URLS)
  await urls_mutex.lock()
  try {
    const cache = (await get(DOWNLOAD_URLS)) || {}
    // Deleting first moves an id already in there back to the end: string keys
    // hold insertion order, which is what makes the oldest droppable.
    delete cache[itemid]
    const next = { ...cache, [itemid]: { filename, url } }
    const ids = Object.keys(next)
    const over = ids.length - DOWNLOAD_URL_LIMIT
    if (over > 0) for (const id of ids.slice(0, over)) delete next[id]
    await set(DOWNLOAD_URLS, next)
  } finally {
    urls_mutex.unlock()
  }
}

/**
 * Drop a remembered URL so the next `as_download_url` asks Storage again.
 * @param {Id} itemid
 * @returns {Promise<void>}
 */
export const forget_download_url = async itemid => {
  const urls_mutex = mutex_for(DOWNLOAD_URLS)
  await urls_mutex.lock()
  try {
    const cache = await get(DOWNLOAD_URLS)
    if (!cache?.[itemid]) return
    const next = { ...cache }
    delete next[itemid]
    await set(DOWNLOAD_URLS, next)
  } finally {
    urls_mutex.unlock()
  }
}

/**
 * Fetch an item's blob, repairing a remembered URL whose token has rotated. Only a
 * remembered URL can be stale, so one resolved fresh in this call is taken at its
 * word — items that were never posted 404 here routinely and must stay one lookup.
 * @param {Id} itemid
 * @returns {Promise<Response | null>}
 */
const fetch_item = async itemid => {
  const cache = (await get(DOWNLOAD_URLS)) || {}
  const was_remembered = typeof cache[itemid]?.url === 'string'

  const remembered = await as_download_url(itemid)
  if (!remembered) return null

  const response = await fetch(remembered)
  if (response.ok) return response
  if (!was_remembered) return null

  await forget_download_url(itemid)
  const fresh = await as_download_url(itemid)
  if (!fresh || fresh === remembered) return null

  const retried = await fetch(fresh)
  return retried.ok ? retried : null
}

/**
 * @param {Response} response
 * @returns {Promise<string | null>}
 */
const as_html = async response => {
  const content_encoding = response.headers.get('Content-Encoding')
  const compressed_html = await response.arrayBuffer()
  if (!content_encoding || content_encoding === 'identity')
    return new TextDecoder().decode(compressed_html)
  return decompress_html(compressed_html)
}

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
 * @param {{ search_archives?: boolean }} [options] - passed through to
 *   `as_archive`; probes the archives rather than trusting the cached directory.
 * @returns {Promise<string>}
 */
export const as_filename = async (itemid, options) => {
  const { as_archive } = await import('@/persistence/Directory')
  const poster_id = as_poster_id(itemid)
  if (poster_id) {
    let poster_filename = poster_id
    if (poster_id.startsWith('/+')) poster_filename = `people${poster_id}`

    const layer_name = as_layer_name(itemid)
    const archive = await as_archive(poster_id, options)

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
    const archive = await as_archive(itemid, options)
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
  const response = await fetch_item(itemid)
  if (!response) return null

  const html = await as_html(response)
  if (!html) return null

  if (typeof localStorage !== 'undefined' && itemid === storage_me()) {
    localStorage.setItem(itemid, html)
    await del(itemid)
  } else await set(itemid, html)
  return item_from_html(html, itemid)
}

/**
 * Loads from network HTTP cache without storing to IndexedDB
 * Used for shadow/cutout types that should rely on HTTP cache when online/signed in
 * @param {Id} itemid
 * @returns {Promise<{item: Item | null, html: string | null}>}
 */
export const load_from_cache = async itemid => {
  const response = await fetch_item(itemid)
  if (!response) return { item: null, html: null }

  const html = await as_html(response)
  if (!html) return { item: null, html: null }

  const item = await item_from_html(html, itemid)
  return { item, html }
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
 * @param {unknown} e
 * @returns {boolean}
 */
const is_storage_not_found = e =>
  !!(
    e &&
    typeof e === 'object' &&
    'code' in e &&
    /** @type {{code?: string}} */ (e).code === 'storage/object-not-found'
  )

/**
 * Poster or layer filename at the pre-archive location.
 * @param {Id} itemid
 * @returns {string | null} null when the itemid is not a poster or layer
 */
export const as_top_level_filename = itemid => {
  const poster_id =
    as_poster_id(itemid) ?? (as_type(itemid) === 'posters' ? itemid : null)
  if (!poster_id) return null
  const poster_filename = poster_id.startsWith('/+')
    ? `people${poster_id}`
    : poster_id
  const layer_name = as_layer_name(itemid)
  const suffix = layer_name ? `-${layer_name}` : ''
  return `${poster_filename}${suffix}.html.gz`
}

/**
 * @param {Id} itemid
 * @returns {Promise<string | null>}
 */
export const as_download_url = async itemid => {
  if (String(itemid) === '/+' || itemid.startsWith('/+/')) return null
  const index = (await get('sync:index')) || {}
  if (is_sync_index_missing(index[itemid])) return null

  const key = String(itemid)
  const existing = download_url_inflight.get(key)
  if (existing) return existing

  const pending = (async () => {
    try {
      const idx = (await get('sync:index')) || {}
      if (is_sync_index_missing(idx[itemid])) return null
      const { url, storage_ready } = await import('@/utils/serverless')
      await storage_ready
      const filename = await as_filename(itemid)
      const remembered = await cached_download_url(itemid, filename)
      if (remembered) return remembered
      try {
        const fresh = await url(filename)
        await remember_download_url(itemid, filename, fresh)
        return fresh
      } catch (e) {
        if (!is_storage_not_found(e)) throw e
        // Archived posters can be split: `move` uploads from the local copy,
        // so a device without every layer cached leaves components at the
        // pre-archive path. Check there before declaring the file missing.
        const fallback = as_top_level_filename(itemid)
        if (fallback && fallback !== filename)
          try {
            const fallback_url = await url(fallback)
            await remember_download_url(itemid, fallback, fallback_url)
            return fallback_url
          } catch (fallback_error) {
            if (!is_storage_not_found(fallback_error)) throw fallback_error
          }

        // And the other direction: a cached directory older than the archive it
        // describes makes `as_archive` call an archived poster un-archived, so
        // `filename` was the pre-archive path all along. Ask the archives
        // themselves before writing the item off — a wrong guess about where a
        // file lives must not become a permanent DOES_NOT_EXIST.
        const searched = await as_filename(itemid, { search_archives: true })
        if (searched !== filename && searched !== fallback)
          try {
            const searched_url = await url(searched)
            await remember_download_url(itemid, searched, searched_url)
            return searched_url
          } catch (searched_error) {
            if (!is_storage_not_found(searched_error)) throw searched_error
          }

        const stale = (await get('sync:index')) || {}
        stale[itemid] = DOES_NOT_EXIST
        await set('sync:index', stale)
        return null
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Storage not initialized')
        return null
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
  const author = as_author(/** @type {Id} */ (poster_id))
  const created = as_created_at(/** @type {Id} */ (poster_id))
  if (!author || !created) return /** @type {Id} */ ('')
  return /** @type {Id} */ (`${author}/${layer}/${created}`)
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
