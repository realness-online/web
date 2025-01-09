/** @typedef {import('@/types').Item_Id} Item_Id */
/** @typedef {import('@/types').Item_Type} Item_Type */
/** @typedef {import('@/types').Created_Id} Created_Id */
/** @typedef {import('@/types').Author_Id} Author_Id */
/** @typedef {import('@/types').Item} Item */
import { get, set, keys } from 'idb-keyval'
import get_item from '@/utils/item'
import { DOES_NOT_EXIST } from '@/use/sync'
import { url, directory } from '@/use/serverless'
import { decompress_html } from '@/utils/upload_processor'

class Directory {
  /**
   * @type {Item_Id}
   */
  id = ''

  /**
   * @type {Item_Type[]}
   */
  types = [] // at the root of the directory folders are types in our vocabulary

  /**
   * @type {Created_Id[]}
   */
  archive = []

  /**
   * @type {Created_Id[]}
   */
  items = []

  /**
   * @param {Item_Id} id
   */
  constructor(id) {
    this.id = id
  }
}

/**
 * @param {Item_Id} itemid
 * @param {Author_Id} me
 * @returns {string | null}
 */
export const load_from_network = async (itemid, me = localStorage.me) => {
  const url = await as_download_url(itemid, me)

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
    return get_item(html)
  }
  return null
}

/**
 * @param {Item_Id} itemid
 * @param {Author_Id} me
 * @returns {Item | null}
 */
export const load = async (itemid, me = localStorage.me) => {
  let item
  if (~itemid.indexOf(me)) {
    item = localStorage.getItem(itemid)
    if (item) return get_item(item)
    else if (as_type(itemid) === 'relations') return []
  }
  const result = await get(itemid)
  item = get_item(result)
  if (item) return item
  try {
    item = await load_from_network(itemid, me)
  } catch (e) {
    if (e.code === 'storage/unauthorized') return null
    throw e
  }
  if (item) return item
  return null
}

/**
 * @param {Item_Id} itemid
 * @param {Author_Id} me
 * @returns {Item_Type[]}
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
 * @param {Item_Id} itemid
 * @returns {Directory | null}
 */
export const load_directory_from_network = async itemid => {
  if (navigator.onLine) {
    const path = as_directory_id(itemid)
    const meta = new Directory()
    console.info('request:directory', itemid)
    const folder = await directory(`people/${path}`)
    folder.items.forEach(item => meta.items.push(item.name.split('.')[0]))
    folder.prefixes.forEach(prefix => meta.archive.push(prefix.name))
    await set(path, meta)
    return meta
  }
  return null
}

/**
 * @param {Item_Id} itemid
 * @returns {Directory | null}
 */
export const as_directory = async itemid => {
  const path = as_directory_id(itemid)
  const cached = await get(path)
  if (cached) {
    console.info('has directory cached', cached)
    return cached
  }
  let directory = await build_local_directory(itemid)
  if (navigator.onLine)
    try {
      directory = await load_directory_from_network(itemid)
    } catch (e) {
      if (e.code === 'storage/unauthorized') return directory
      throw e
    }

  return directory
}

/**
 * @param {Item_Id} itemid
 * @returns {string | null}
 */
export const as_download_url = async itemid => {
  if (itemid.startsWith('/+/')) return null
  try {
    return await url(as_filename(itemid))
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(itemid, '=>', as_filename(itemid))
      const index = (await get('sync:index')) || {}
      index[itemid] = DOES_NOT_EXIST
      await set('sync:index', index)
      return null
    }
    throw e
  }
}

/**
 * @type {Item_Type[]}
 */
const created_at = ['posters', 'animations']

/**
 * @type {Item_Type[]}
 */
const has_history = ['statements', 'events']

/**
 * Splits an item ID path into its constituent parts
 * @param {Item_Id} itemid - The full item path (e.g. '/+123456/statements/789')
 * @returns {[Author_Id] | [Author_Id, Item_Type] | [Author_Id, Item_Type, Created_Id]} Array of path parts where:
 *   [0] = author ID (e.g. '+123456')
 *   [1] = item type (e.g. 'statements', 'events', 'posters', etc.)
 *   [2] = created_at timestamp (if applicable)
 * @example
 * as_path_parts('/+123456/statements/789') // ['+123456', 'statements', '789']
 * as_path_parts('/+123456') // ['+123456']
 */
export const as_path_parts = itemid => {
  const path = itemid.split('/')
  if (path[0].length === 0) path.shift()
  return /** @type {[Author_Id] | [Author_Id, Item_Type] | [Author_Id, Item_Type, Created_Id]} */ (
    path
  )
}

/**
 * @param {Item_Id} itemid
 * @returns {boolean}
 */
export const is_history = itemid => {
  const parts = as_path_parts(itemid)
  if (has_history.includes(as_type(itemid)) && parts.length === 3) return true
  return false
}

/**
 * @param {Item_Id} itemid
 * @returns {string}
 */
export const as_filename = itemid => {
  let filename = itemid
  if (itemid.startsWith('/+')) filename = `/people${filename}`
  if (created_at.includes(as_type(itemid)) || is_history(itemid))
    return `${filename}.html.gz`
  return `${filename}/index.html.gz`
}

/**
 * @param {Item_Id} itemid
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
 * @param {Item_Id} itemid
 * @returns {Directory | null}
 */
export const build_local_directory = async itemid => {
  const path = as_directory_id(itemid)
  const directory = new Directory()
  const everything = await keys()
  everything.forEach(itemid => {
    if (as_directory_id(itemid) === path) {
      const id = as_created_at(itemid)
      if (id) directory.items.push(id)
    }
  })
  return directory
}

/**
 * @param {Item_Id} itemid
 * @returns {string}
 */
export const as_directory_id = itemid => {
  const parts = as_path_parts(itemid)
  return `/${parts[0]}/${parts[1]}/`
}

/**
 * @param {Item_Id} itemid
 * @returns {string | null}
 */
export const as_author = itemid => {
  const path = as_path_parts(itemid)
  const author = path[0] || ''
  if (author.startsWith('+1')) return `/${path[0]}`
  return null
}

/**
 * @param {Item_Id} itemid
 * @returns {Item_Type | null}
 */
export const as_type = itemid => {
  const path = as_path_parts(itemid)
  if (path[1]) return path[1]
  if (itemid.startsWith('/+')) return 'person'
  return null
}

/**
 * @param {Item_Id} itemid
 * @returns {Created_Id | null}
 */
export const as_created_at = itemid => {
  const path = as_path_parts(itemid)
  if (path.length === 1) return parseInt(path[0])
  return parseInt(path[2])
}

/**
 * @param {Item_Id} itemid
 * @returns {string}
 */
export const as_query_id = itemid =>
  itemid.substring(2).replace('/', '-').replace('/', '-')

/**
 * @param {Item_Id} itemid
 * @returns {string}
 */
export const as_fragment_id = itemid => `#${as_query_id(itemid)}`

/**
 * @param {Item} item
 * @returns {Item_Type[]}
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
