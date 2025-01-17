/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */

import { as_path_parts, as_created_at } from '@/utils/itemid'
import { get, set, keys } from 'idb-keyval'
import { directory } from '@/utils/serverless'

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
   * @type {(Created|Directory)[]}
   */
  archive = []

  /**
   * @type {Id[]}
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
  const [author, type] = as_path_parts(itemid)
  if (itemid?.endsWith('/')) return itemid
  return `/${author}/${type}/index/` // Trailing slash indicates directory
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const build_local_directory = async itemid => {
  console.time('build_local_directory')
  const path = /** @type {Id} */ (as_directory_id(itemid))
  const directory = new Directory(path)
  const everything = await keys()
  everything.forEach(itemid => {
    if (as_directory_id(/** @type {Id} */ (itemid)) === path) {
      const id = as_created_at(/** @type {Id} */ (itemid))
      if (id) directory.items.push(/** @type {Id} */ (itemid))
    }
  })
  console.timeEnd('build_local_directory')
  return directory
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const load_directory_from_network = async itemid => {
  if (navigator.onLine) {
    const [author, type, created = null, archive = null] = as_path_parts(itemid)

    const path = as_directory_id(itemid)

    const meta = new Directory(/** @type {Id} */ (path))
    console.group('request:directory')
    console.info('itemid', itemid)
    console.info('author', author)
    console.info('type', type)
    console.info('created', created)
    console.info('archive', archive)
    console.groupEnd()

    let firebase_path = `people/${author}/${type}/`
    if (archive) firebase_path += `${archive}/`
    const folder = await directory(firebase_path)
    folder.items.forEach(item =>
      meta.items.push(/** @type {Id} */ (item.name.split('.')[0]))
    )
    folder.prefixes.forEach(prefix => meta.archive.push(parseInt(prefix.name)))
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
