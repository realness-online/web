// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/storage'
import 'firebase/auth'
import { hydrate,
        get_item,
        get_type,
        get_itemprops } from '@/modules/item'
import { load, load_from_network } from '@/helpers/itemid'
import profile from '@/helpers/profile'
import { History } from '@/persistance/Storage'
function get_oldest_at(elements, prop_name) {
  const list = get_itemprops(elements)
  console.log(list);
  const props = list[prop_name]
  const oldest = props[props.length -1]
  return Date.parse(oldest.created_at)
}
function is_fat (items, prop_name) {
  const today = new Date().setHours(0, 0, 0, 0)
  const as_kilobytes = (items.outerHTML.length / 1024).toFixed(2)
  if ((as_kilobytes > 5) && (get_oldest_at(items, prop_name) < today)) return true // only count stuff before today
  else return false
}
export function as_kilobytes (itemid) {
  const bytes = localStorage.getItem(itemid)
  if (bytes) return (bytes.length / 1024).toFixed(2)
  else return 0
}
const Paged = (superclass) => class extends superclass {
  async optimize () {
    // First in first out storage (FIFO)
    if (as_kilobytes(this.id) > 13) {
      const current = hydrate(localStorage.getItem(this.id)).childNodes[0]
      const offload = document.createDocumentFragment()
      while (is_fat(current, this.type)) {
        const fatty = current.childNodes[current.childNodes.length - 1]
        const new_sibling = offload.childNodes[0] || null
        offload.insertBefore(current.removeChild(fatty), new_sibling)
      }
      let div = document.createElement(current.nodeName)
      div.setAttribute('itemscope', '')
      div.setAttribute('itemid', this.id)
      div.appendChild(offload)
      const me = profile.from_e64(firebase.auth().currentUser.phoneNumber)
      const id = `${me}/${this.type}/${get_oldest_at(div, this.type)}.html`
      await this.save(current)
      new History(id).save(div)
    }
  }
  async sync_list () {
    let items, oldest_at = 0 // the larger the number the more recent it is
    const cloud = (await load_from_network(this.id))[this.type]
    const local = (await load(this.id))[this.type]
    const length = cloud.length
    if (length) oldest_at = Date.parse(cloud[length - 1].created_at)
    if (local.length) {
      const new_local_stuff = local.filter(local_item => {
        const created_at = Date.parse(local_item.created_at)
        // local older items are ignored, probably optimized away
        if (oldest_at > created_at) return false
        return !cloud.some(server_item => {
          return local_item.created_at === server_item.created_at
        })
      })
      items = [...new_local_stuff, ...cloud]
      items.sort(sorting.newer_first)
    } else items = cloud
    return items
  }
}
export default Paged
