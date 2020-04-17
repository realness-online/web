import * as firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/auth'
import Item from '@/modules/item'
import { person_storage as myself } from '@/persistance/Storage'
import { get, set } from 'idb-keyval'
const large = ['avatars', 'posters']
export async function load (itemid, me = myself.as_object()) {
  const element = document.getElementById(as_query_id(itemid))
  if (element) return Item.get_items(element)
  let items = []
  if (~itemid.indexOf(me.id)) items = Item.get_items(localStorage.getItem(itemid))
  if (!items.length) items = Item.get_items(await get(itemid))
  if (!items.length) items = await load_from_network(itemid, me)
  return items
}
export async function load_from_network (itemid, me = myself.as_object()) {
  const url = await as_download_url(itemid, me)
  if (url) {
    const server_text = await (await fetch(url)).text()
    set(itemid, server_text)
    return Item.get_items(server_text)
  } else return []
}
export async function as_directory (itemid, me = myself.as_object()) {
  const path = as_directory_path(itemid)
  const cached = await get(path)
  if (cached) return cached
  if (!firebase.auth().currentUser) return null
  if (navigator.onLine) {
    const meta = { items: [], types: [] } // in our vocabulary folders are types
    console.info(`${me.first_name} makes a firebase request`)
    const directory = await firebase.storage().ref().child(path).listAll()
    directory.items.forEach(item => meta.items.push(item.name))
    directory.prefixes.forEach(folder => meta.types.push(folder.name))
    set(path, meta)
    return meta
  } else return null
}
export async function as_object (itemid, me = myself.as_object()) {
  return (await load(itemid, me))[0]
}
export async function as_download_url (itemid, me = myself.as_object()) {
  if (!firebase.auth().currentUser) return null
  const storage = firebase.storage().ref()
  try {
    console.info(`${me.first_name} makes a firebase request`)
    return await storage.child(as_filename(itemid)).getDownloadURL()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(itemid, '=>', as_filename(itemid))
      return null
    } else throw e
  }
}
export function as_directory_path (itemid) {
  const path_parts = itemid.split('/')
  if (~path_parts[0].length) path_parts.shift() // remove empty split
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
export function as_type (itemid) {
  const path = itemid.split('/')
  if (~path[0].length) path.shift()
  if (path[1]) return path[1]
  if (itemid.startsWith('/+')) return 'person'
  else return null
}
export function as_query_id (itemid) {
  return itemid.substring(2).replace('/', '-').replace('/', '-')
}
export function as_fragment (itemid) {
  return `#${as_query_id(itemid)}`
}
export default { load, as_object, as_fragment, as_query_id, as_directory }
