import * as firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/auth'
import get_item from '@/modules/item'
// import { get, set } from 'idb-keyval'
import { set } from 'idb-keyval'
const large = ['avatars', 'posters']
const has_history = ['statements', 'events']

export async function load (itemid, me = localStorage.me) {
  const element = document.getElementById(as_query_id(itemid))
  if (element) return get_item(element)
  let item
  if (~itemid.indexOf(me)) {
    item = localStorage.getItem(itemid)
    if (item) return get_item(item)
  }
  item = get_item(await get(itemid))
  if (item) return item
  item = await load_from_network(itemid, me)
  if (item) return item
  return null
}
export async function list (itemid, me = localStorage.me) {
  // Returns a list even if loading the item fails
  try {
    const item = await load(itemid, me)
    const type = as_type(itemid)
    const list = item[type]
    if (list && Array.isArray(list)) return list
    else if (list) return [list]
    else return []
  } catch { return [] }
}
export async function load_from_network (itemid, me = localStorage.me) {
  const url = await as_download_url(itemid, me)
  if (url) {
    console.info('Loads a storage item')
    const server_text = await (await fetch(url)).text()
    set(itemid, server_text)
    return get_item(server_text, itemid)
  } else return null
}
export async function as_directory (itemid, me = localStorage.me) {
  const path = as_directory_id(itemid)
  // const cached = await get(path)
  // if (cached) return cached
  // else
  if (navigator.onLine && firebase.auth().currentUser) {
    const meta = { items: [], types: [] } // folders are types in our vocabulary
    console.info(`Makes a directory request for ${path}`)
    const directory = await firebase.storage().ref().child(`people/${path}`).listAll()
    directory.items.forEach(item => meta.items.push(item.name.split('.')[0]))
    directory.prefixes.forEach(prefix => meta.types.push(prefix.name))
    set(path, meta)
    return meta
  } else return null
}
export async function as_download_url (itemid, me = localStorage.me) {
  if (!firebase.auth().currentUser) return null
  const storage = firebase.storage().ref()
  try {
    console.info(`Makes a storage request for ${itemid}`)
    return await storage.child(as_filename(itemid)).getDownloadURL()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(itemid, '=>', as_filename(itemid))
      return null
    } else throw e
  }
}
export function as_storage_path (itemid) {
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
export function as_directory_id (itemid) {
  const parts = as_path_parts(itemid)
  return `/${parts[0]}/${parts[1]}/`
}
export function as_filename (itemid) {
  let filename = itemid
  if (itemid.startsWith('/+')) filename = `/people${filename}`
  if (large.includes(as_type(itemid)) || is_history(itemid)) return `${filename}.html`
  else return `${filename}/index.html`
}
export function is_history (itemid) {
  const parts = as_path_parts(itemid)
  if (has_history.includes(as_type(itemid)) && parts.length === 3) return true
  return false
}
export function as_path_parts (itemid) {
  const path = itemid.split('/')
  if (~path[0].length) path.shift()
  return path
}
export function as_author (itemid) {
  const path = as_path_parts(itemid)
  if (path[0]) return `/${path[0]}`
  else return null
}
export function as_type (itemid) {
  const path = as_path_parts(itemid)
  if (path[1]) return path[1]
  if (itemid.startsWith('/+')) return 'person'
  else return null
}
export function as_created_at (itemid) {
  const path = as_path_parts(itemid)
  return parseInt(path[2])
}
export function as_query_id (itemid) {
  return itemid.substring(2).replace('/', '-').replace('/', '-')
}
export function as_fragment (itemid) {
  return `#${as_query_id(itemid)}`
}
export default {
  load,
  list,
  as_directory,
  as_created_at,
  as_fragment,
  as_query_id
}
