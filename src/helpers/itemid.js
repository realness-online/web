// {base_url}/{:author}/{:type}/{:created_at}
import firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/auth'
import get_item from '@/modules/item'
import { does_not_exist } from '@/persistance/Cloud.sync'
import { get, set } from 'idb-keyval'
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
  item = await load_from_network(itemid, me)
  if (item) return item
  return null
}
export async function list(itemid, me = localStorage.me) {
  try {
    const item = await load(itemid, me)
    if (item) return type_as_list(item)
    else return []
  } catch {
    return []
  }
}
export async function load_from_network(itemid, me = localStorage.me) {
  const url = await as_download_url(itemid, me)
  if (url) {
    console.info('download', itemid)
    const server_text = await (await fetch(url)).text()
    await set(itemid, server_text)
    return get_item(server_text)
  } else return null
}
export async function as_directory(itemid) {
  const path = as_directory_id(itemid)
  const cached = await get(path)
  if (cached) return cached
  else if (navigator.onLine && firebase.auth().currentUser) {
    const meta = { items: [], types: [] } // folders are types in our vocabulary
    console.info('request:directory', itemid)
    const directory = await firebase.storage().ref().child(`people/${path}`).listAll()
    directory.items.forEach(item => meta.items.push(item.name.split('.')[0]))
    directory.prefixes.forEach(prefix => meta.types.push(prefix.name))
    await set(path, meta)
    return meta
  } else return null
}
export async function as_download_url(itemid) {
  if (!firebase.auth().currentUser) return null
  const storage = firebase.storage().ref()
  try {
    console.info('request:location', itemid)
    return await storage.child(as_filename(itemid)).getDownloadURL()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(itemid, '=>', as_filename(itemid))
      const index = (await get('sync:index')) || {}
      index[itemid] = does_not_exist
      await set('sync:index', index)
      return null
    } else throw e
  }
}

// Cheap to call
const created_at = ['avatars', 'posters', 'animations']
const has_history = ['statements', 'events']
export function is_history(itemid) {
  const parts = as_path_parts(itemid)
  if (has_history.includes(as_type(itemid)) && parts.length === 3) return true
  return false
}
export function as_filename(itemid) {
  let filename = itemid
  if (itemid.startsWith('/+')) filename = `/people${filename}`
  if (created_at.includes(as_type(itemid)) || is_history(itemid)) return `${filename}.html`
  else return `${filename}/index.html`
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
  else return null
}
export function as_type(itemid) {
  const path = as_path_parts(itemid)
  if (path[1]) return path[1]
  if (itemid.startsWith('/+')) return 'person'
  else return null
}
export function as_created_at(itemid) {
  const path = as_path_parts(itemid)
  return parseInt(path[2])
}
export function as_query_id(itemid) {
  return itemid.substring(2).replace('/', '-').replace('/', '-')
}
export function as_fragment(itemid) {
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
  else return []
}
