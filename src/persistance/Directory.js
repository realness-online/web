/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Type} Type */
/** @typedef {import('@/types').Created} Created */

import { as_path_parts, as_created_at } from '@/utils/itemid'
import { get, set, keys } from 'idb-keyval'
import { directory } from '@/utils/serverless'
const PARTS = {
  AUTHOR: 0,
  TYPE: 1,
  ARCHIVE: 2
}
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
    this.id = as_directory_id(id)
  }

  for_firebase() {
    const [author, type] = as_path_parts(this.id)
    return `/${author}/${type}/` // Trailing slash indicates directory
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
export const for_firebase = itemid => {
  const [author, type, created = 'index'] = as_path_parts(itemid)
  return `/${author}/${type}` // Trailing slash indicates directory
}

/**
 * @param {Id} itemid
 * @returns {string}
 */
export const as_directory_id = itemid => {
  const [author, type, created, archive] = as_path_parts(itemid)
  let path = `/${author}/${type}/index/` // Trailing slash indicates directory
  if (archive) path = `/${author}/${type}/index/`
  return path
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const build_local_directory = async itemid => {
  console.time('build_local_directory')
  const path = as_directory_id(itemid)
  const directory = new Directory(path)
  const everything = await keys()
  everything.forEach(itemid => {
    if (as_directory_id(itemid) === path) {
      const id = as_created_at(itemid)
      if (id) directory.items.push(id)
    }
  })
  console.timeEnd('build_local_directory')
  return directory
}

/**
 * @param {Id} itemid
 * @returns {Promise<Directory | null>}
 */
export const load_directory_from_network = async (itemid, archive = false) => {
  if (navigator.onLine) {
    const [author, type, created = null] = as_path_parts(itemid)
    let path = as_directory_id(itemid)
    console.log('created', created)
    if (created) path = as_path_parts(itemid)

    console.log('cleaned for firebase', path)
    const meta = new Directory(path)

    console.info('request:directory', itemid)

    const for_firebase = path

    const folder = await directory(`people/${meta.for_firebase()}`)
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
export const as_directory = async itemid => {
  const path = as_directory_id(itemid)
  const cached = await get(path)
  if (cached) {
    console.info('has directory cached', cached)
    return cached
  }
  let directory = await build_local_directory(itemid)
  console.log('directory', directory)
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
export const as_history = async itemid => {
  console.time('as_history')
  const cached = await get(itemid)
  if (cached) {
    console.info('has directory cached', cached)
    return cached
  }
  const directory = await load_directory_from_network(itemid, true)

  console.timeEnd('as_history')
  return directory
}
