// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import { newer_item_first } from '@/helpers/sorting'
import 'firebase/storage'
import 'firebase/auth'
import {
  hydrate,
  get_itemprops
} from '@/modules/item'
import {
  list,
  load_from_network,
  as_created_at
} from '@/helpers/itemid'
import profile from '@/helpers/profile'
import { History } from '@/persistance/Storage'
function get_oldest (elements, prop_name) {
  const list = get_itemprops(elements)
  const props = list[prop_name]
  props.sort(newer_item_first)
  const oldest = props[props.length - 1]
  return new Date(as_created_at(oldest.id))
}
function is_fat (items, prop_name) {
  const today = new Date().setHours(0, 0, 0, 0)
  if (
    (elements_as_kilobytes(items) > 5) &&
    (get_oldest(items, prop_name) < today)
  ) return true // only count stuff before today
  else return false
}
export function itemid_as_kilobytes (itemid) {
  const bytes = localStorage.getItem(itemid)
  if (bytes) return (bytes.length / 1024).toFixed(2)
  else return 0
}
export function elements_as_kilobytes (elements) {
  if (elements) return (elements.outerHTML.length / 1024).toFixed(2)
  else return 0
}
const Paged = (superclass) => class extends superclass {
  async save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    if (!items) return
    await this.sync()
    if (super.save) super.save(items)
    await this.optimize()
  }
  async optimize () {
    // First in first out storage (FIFO)
    if (itemid_as_kilobytes(this.id) > 13) {
      const current = hydrate(localStorage.getItem(this.id)).childNodes[0]
      const oldest = get_oldest(current, this.type)
      const offload = document.createDocumentFragment()
      const original_size = elements_as_kilobytes(current)
      let amount_moved = 0
      while (is_fat(current, this.type) && amount_moved <= 8) {
        const fatty = current.childNodes[current.childNodes.length - 1]
        const new_sibling = offload.childNodes[0] || null
        offload.insertBefore(current.removeChild(fatty), new_sibling)
        amount_moved = original_size - elements_as_kilobytes(current)
      }
      const div = document.createElement(current.nodeName)
      div.setAttribute('itemscope', '')
      div.setAttribute('itemid', this.id)
      div.appendChild(offload)
      const me = profile.from_e64(firebase.auth().currentUser.phoneNumber)
      const id = `${me}/${this.type}/${oldest.getTime()}`
      await this.save(current)
      const history = new History(id)
      await history.save(div)
      if (elements_as_kilobytes(current) > 13) {
        await this.optimize()
      }
    }
  }
  async sync () {
    let items
    let oldest_at = 0 // the larger the number the more recent it is
    const local_items = await list(this.id)
    const cloud = await load_from_network(this.id)
    if (!cloud) return local_items
    let cloud_items = cloud[cloud.type]
    if (cloud_items) {
      if (!Array.isArray(cloud_items)) cloud_items = [cloud_items]
      cloud_items.sort(newer_item_first)
      const oldest_id = cloud_items[cloud_items.length - 1].id
      oldest_at = as_created_at(oldest_id)
    }
    if (local_items && local_items.length && cloud_items) {
      local_items.sort(newer_item_first)
      const new_local_stuff = local_items.filter(local_item => {
        const created_at = as_created_at(local_item.id)
        if (oldest_at > created_at) return false // local older items are ignored, have been optimized away
        return !cloud_items.some(server_item => { // remove local items that are in the cloud
          return local_item.id === server_item.id
        })
      })
      const offline_items = await list(`/+/${this.type}`, '/+')
      // three distinct lists are recombined into a single synced list
      items = [...new_local_stuff, ...cloud_items, ...offline_items]
      items.sort(newer_item_first)
    } else items = cloud_items
    return items
  }
}
export default Paged
