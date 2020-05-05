import * as firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/auth'
import get_item from '@/modules/item'
import { get, set } from 'idb-keyval'
const large = ['avatars', 'posters']

export async function load (itemid, me = localStorage.getItem('me')) {
  const element = document.getElementById(as_query_id(itemid))
  if (element) return get_item(element)
  let item
  const mine = ~itemid.indexOf(me)
  if (mine) {
    item = localStorage.getItem(itemid)
    if (item) return get_item(item)
  }
  if (item = get_item(await get(itemid))) return item
  else if (item = await load_from_network(itemid, me)) return item
  return null
}
export async function list (itemid, me = localStorage.getItem('me')) {
  const type = as_type(itemid)
  const list = await load(itemid, me)
  return list[type]
}
export async function load_from_network (itemid, me = localStorage.getItem('me')) {
  const url = await as_download_url(itemid, me)
  if (url) {
    console.info('loads a storage item')
    const server_text = await (await fetch(url)).text()
    set(itemid, server_text)
    return get_item(server_text, itemid)
  } else return null
}
export async function as_directory (itemid, me = localStorage.getItem('me')) {
  const path = as_directory_path(itemid)
  const cached = await get(path)
  if (cached) return cached
  if (!firebase.auth().currentUser) return null
  if (navigator.onLine) {
    const meta = { items: [], types: [] } // in our vocabulary folders are types
    console.info('Makes a storage request')
    const directory = await firebase.storage().ref().child(path).listAll()
    directory.items.forEach(item => meta.items.push(item.name))
    directory.prefixes.forEach(folder => meta.types.push(folder.name))
    set(path, meta)
    return meta
  } else return null
}
export async function as_download_url (itemid, me = localStorage.getItem('me')) {
  if (!firebase.auth().currentUser) return null
  const storage = firebase.storage().ref()
  try {
    console.info('Makes a storage request')
    return await storage.child(as_filename(itemid)).getDownloadURL()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(itemid, '=>', as_filename(itemid))
      return null
    } else throw e
  }
}
export function as_directory_path (itemid) {
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
export function as_filename (itemid) {
  let filename = itemid
  if (itemid.startsWith('/+')) filename = `/people${filename}`
  if (large.includes(as_type(itemid))) return `${filename}.html`
  else return `${filename}/index.html`
}
export function as_path_parts (itemid) {
  const path = itemid.split('/')
  if (~path[0].length) path.shift()
  return path
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
export default { load, list, as_directory, as_created_at, as_fragment, as_query_id}
