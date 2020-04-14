import * as firebase from 'firebase/app'
import 'firebase/storage'
import Item from '@/modules/item'
import { person_storage as myself } from '@/persistance/Storage'
import { get_download_url } from '@/persistance/Cloud'
import { get, set } from 'idb-keyval'
export async function load (itemid, me = myself.as_object().id) {
  const element = document.getElementById(as_query_id(itemid))
  if (element) return Item.get_items(element)
  let items = []
  if (~itemid.indexOf(me)) items = Item.get_items(localStorage.getItem(itemid))
  if (!items.length) items = Item.get_items(await get(itemid))
  if (!items.length) items = await load_from_network(itemid, me)
  return items
}
export async function load_from_network (itemid, me = myself.as_object().id) {
  const url = await get_download_url(itemid)
  if (url) {
    const server_text = await (await fetch(url)).text()
    set(itemid, server_text)
    return Item.get_items(server_text)
  } else return []
}
export async function directory (itemid, me = myself.as_object().id ) {
  const storage = firebase.storage().ref()
  let path = itemid
  if (itemid.startsWith('/+')) path = `/people${itemid}`
  console.log(path)
  if (navigator.onLine) {
    return storage.child(path).listAll()
  } else return null
}
export function as_path(itemid) {

}
export async function as_object (itemid, me = myself.as_object().id) {
  return (await load(itemid, me))[0]
}
export function as_query_id (itemid) {
  return itemid.substring(2).replace('/', '-').replace('/', '-')
}
export function as_fragment (itemid) {
  return `#${as_query_id(itemid)}`
}
export default { load, as_object, as_fragment, as_query_id, directory }
