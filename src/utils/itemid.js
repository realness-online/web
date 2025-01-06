// {base_url}/{:author}/{:type}/{:created_at}
import { get, set, keys } from 'idb-keyval'
import get_item from '@/utils/item'
import { DOES_NOT_EXIST } from '@/use/sync'
import { url, directory } from '@/use/serverless'
import { decompress_html } from '@/utils/upload_processor'

class Directory {
  constructor() {
    this.items = []
    this.types = [] // folders are types in our vocabulary
  }
}
// Expensive to call
export async function load(itemid, me = localStorage.me) {
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
export async function list(itemid, me = localStorage.me) {
  try {
    const item = await load(itemid, me)
    if (item) return type_as_list(item)
    return []
  } catch {
    return []
  }
}
export async function load_from_network(itemid, me = localStorage.me) {
  const url = await as_download_url(itemid, me)

  if (url) {
    console.info('download', itemid)
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
export async function load_directory_from_network(itemid) {
  if (navigator.onLine) {
    const path = as_directory_id(itemid)
    const meta = new Directory()
    console.info('request:directory', itemid)
    const folder = await directory(`people/${path}`)
    folder.items.forEach(item => meta.items.push(item.name.split('.')[0]))
    folder.prefixes.forEach(prefix => meta.types.push(prefix.name))
    await set(path, meta)
    return meta
  }
  return null
}
export async function as_directory(itemid) {
  const path = as_directory_id(itemid)
  const cached = await get(path)
  if (cached) {
    console.log('has directory cached')
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
export async function as_download_url(itemid) {
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

// Cheap to call
const created_at = ['posters', 'animations']
const has_history = ['statements', 'events']
export function is_history(itemid) {
  const parts = as_path_parts(itemid)
  if (has_history.includes(as_type(itemid)) && parts.length === 3) return true
  return false
}

export function as_filename(itemid) {
  let filename = itemid
  if (itemid.startsWith('/+')) filename = `/people${filename}`
  if (created_at.includes(as_type(itemid)) || is_history(itemid))
    return `${filename}.html.gz`
  return `${filename}/index.html.gz`
}
export function as_storage_path(itemid) {
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
export async function build_local_directory(itemid) {
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
export function as_directory_id(itemid) {
  const parts = as_path_parts(itemid)
  return `/${parts[0]}/${parts[1]}/`
}
export function as_path_parts(itemid) {
  const path = itemid.split('/')
  if (path[0].length === 0) path.shift()
  return path
}
export function as_author(itemid) {
  const path = as_path_parts(itemid)
  const author = path[0] || ''
  if (author.startsWith('+1')) return `/${path[0]}`
  return null
}
export function as_type(itemid) {
  const path = as_path_parts(itemid)
  if (path[1]) return path[1]
  if (itemid.startsWith('/+')) return 'person'
  return null
}
export function as_created_at(itemid) {
  const path = as_path_parts(itemid)
  if (path.length === 1) return parseInt(path[0])
  return parseInt(path[2])
}
export function as_query_id(itemid) {
  return itemid.substring(2).replace('/', '-').replace('/', '-')
}
export function as_fragment_id(itemid) {
  return `#${as_query_id(itemid)}`
}
export function type_as_list(item) {
  // Returns a list even if loading the item fails
  // the microdata spec requires properties values to
  // single value and iterable
  if (!item) return []
  const list = item[as_type(item.id)]
  if (list && Array.isArray(list)) return list
  else if (list) return [list]
  return []
}