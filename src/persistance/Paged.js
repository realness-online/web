// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { recent_item_first } from '@/use/sorting'
import { current_user } from '@/use/serverless'
import { get_item, hydrate, get_itemprops } from '@/use/item'
import { from_e64 } from '@/use/people'
import { History } from '@/persistance/Storage'
import {
  list,
  type_as_list,
  load_from_network,
  as_created_at
} from '@/use/itemid'
function get_oldest(elements, prop_name) {
  const list = get_itemprops(elements)
  const props = list[prop_name]
  props.sort(recent_item_first)
  const oldest = props[props.length - 1]
  return new Date(as_created_at(oldest.id))
}
export function is_fat(items, prop_name) {
  const today = new Date().setHours(0, 0, 0, 0)
  if (elements_as_kilobytes(items) > 5 && get_oldest(items, prop_name) < today)
    return true
  // only count stuff before today
  else return false
}
export function itemid_as_kilobytes(itemid) {
  const bytes = localStorage.getItem(itemid)
  if (bytes) return (bytes.length / 1024).toFixed(2)
  else return 0
}
export function elements_as_kilobytes(elements) {
  if (elements) return (elements.outerHTML.length / 1024).toFixed(2)
  else return 0
}
const Paged = superclass =>
  class extends superclass {
    async optimize() {
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
        const me = from_e64(current_user.value.phoneNumber)
        const id = `${me}/${this.type}/${oldest.getTime()}`
        await this.save(current)
        const history = new History(id)
        await history.save(div)
        if (elements_as_kilobytes(current) > 13) {
          await this.optimize()
        }
      }
    }
    async sync() {
      let oldest_at = 0 // the larger the number the more recent it is
      let cloud = await load_from_network(this.id)
      if (cloud) cloud = type_as_list(cloud).sort(recent_item_first)
      else cloud = []
      if (cloud.length > 0) {
        const oldest_id = cloud[cloud.length - 1].id
        oldest_at = as_created_at(oldest_id)
      }

      let local = await list(this.id)
      local.sort(recent_item_first)
      local = local.filter(local_item => {
        const created_at = as_created_at(local_item.id)
        if (oldest_at > created_at) return false // local older items are ignored, have been optimized away
        return !cloud.some(server_item => 
          // remove local items that are in the cloud
           local_item.id === server_item.id
        )
      })

      let offline = localStorage.getItem(`/+/${this.type}`)
      offline = type_as_list(get_item(offline))
      offline.forEach(item => {
        // convert id's to current id
        const me = from_e64(current_user.value.phoneNumber)
        item.id = `${me}/${this.type}/${as_created_at(item.id)}`
      })

      // three distinct lists are recombined into a single synced list
      const items = [...local, ...cloud, ...offline]
      items.sort(recent_item_first)

      return items
    }
  }
export default Paged
