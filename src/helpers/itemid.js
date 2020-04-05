import Item from '@/modules/item'
import { person_storage as myself } from '@/persistance/Storage'
import { get_download_url } from '@/persistance/Cloud'
// import { set } from 'idb-keyval'
export default {
  async load (itemid) {
    const item = this.load_from_page(itemid)
    if (item) return item
    else return this.load_from_network(itemid)
  },
  async load_from_network (itemid, me = myself.as_object().id) {
    const url = await get_download_url(itemid)
    if (url) {
      const server_text = await (await fetch(url)).text()
      return Item.get_first_item(server_text)
    } else return null
  },
  load_from_page (itemid) {
    const element = document.getElementById(this.as_query_id(itemid))
    if (element) return Item.get_first_item(element)
    else return null
  },
  as_query_id (itemid = '/+') {
    return itemid.substring(2).replace('/', '-').replace('/', '-')
  },
  as_fragment (itemid) {
    return `#${this.as_query_id(itemid)}`
  }
}
// check for it on the page
// check for it in local_storage
// check for it on indexdb
// check for it on the network
