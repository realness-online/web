import Item from '@/modules/item'
import { person_storage as myself } from '@/persistance/Storage'
import { get_download_url } from '@/persistance/Cloud'
import { get, set } from 'idb-keyval'

async function load (itemid, me = myself.as_object().id) {
  const item = load_locally(itemid, me)
  if (Object.keys(item).length) return item
  else return load_from_network(itemid)
}
async function load_locally (itemid, me) {
  const item = load_from_page(itemid)
  if (Object.keys(item).length) return item
  return itemid.search(me) ? load_mine(itemid) : Item.get_first_item(get(itemid))
}
async function load_mine (itemid) {
  const item = Item.get_first_item(localStorage.getItem(itemid))
  if (Object.keys(item).length) return item
  else return Item.get_first_item(get(itemid))
}
      function load_from_page (itemid) {
        const element = document.getElementById(as_query_id(itemid))
        if (element) return Item.get_first_item(element)
        else return null
      }
async function load_from_network (itemid, me) {
  const url = await get_download_url(itemid)
  if (url) {
    const server_text = await (await fetch(url)).text()
    set(itemid, server_text)
    return Item.get_first_item(server_text)
  } else return null
}

function as_query_id (itemid = '/+') {
  return itemid.substring(2).replace('/', '-').replace('/', '-')
}
function as_fragment (itemid) {
  return `#${as_query_id(itemid)}`
}
export default { load, as_fragment, as_query_id }
