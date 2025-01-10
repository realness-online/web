/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */

import { as_path_parts, as_type, as_created_at } from '@/utils/itemid'
import { get, set, keys } from 'idb-keyval'
import { directory } from '@/utils/serverless'

/**
 * @implements {Directory}
 */
class Directory {
  /**
   * @type {Id}
   */
  id = ''

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
    this.id = id
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
  const parts = as_path_parts(itemid)
  return `/${parts[0]}/${parts[1]}/`
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const load_directory_from_network = async itemid => {
  if (navigator.onLine) {
    const path = as_directory_id(itemid)
    const meta = new Directory(path)
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
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const build_local_directory = async itemid => {
  const path = as_directory_id(itemid)
  const directory = new Directory(path)
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

/**
 * @param {Id} itemid
 * @returns {boolean}
 */
export const as_history = itemid => {
  const parts = as_path_parts(itemid)
  if (has_history.includes(as_type(itemid)) && parts.length === 3) {
    const archive = parts[2]
  }
  return false
}
