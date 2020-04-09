import Item from '@/modules/item'
import { person_storage as myself } from '@/persistance/Storage'
import { get_download_url } from '@/persistance/Cloud'
import { get, set } from 'idb-keyval'
async function load (itemid, me = myself.as_object().id) {
  const element = document.getElementById(as_query_id(itemid))
  if (element) return Item.get_items(element)
  let items = []
  if (~itemid.indexOf(me)) items = Item.get_items(localStorage.getItem(itemid))
  if (!items.length) items = Item.get_items(await get(itemid))
  if (!items.length) items = await load_from_network(itemid)
  return items
}
async function load_from_network (itemid, me) {
  const url = await get_download_url(itemid)
  if (url) {
    const server_text = await (await fetch(url)).text()
    set(itemid, server_text)
    return Item.get_items(server_text)
  } else return []
}
async function as_object (itemid, me = myself.as_object().id) {
  return (await load(itemid, me))[0]
}
function as_query_id (itemid) {
  return itemid.substring(2).replace('/', '-').replace('/', '-')
}
function as_fragment (itemid) {
  return `#${as_query_id(itemid)}`
}
export default { load, load_from_network, as_object, as_fragment, as_query_id }
