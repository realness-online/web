// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { hydrate, get_item, get_type } from '@/modules/item'
import { load, load_from_network } from '@/helpers/itemid'
import growth from '@/modules/growth'
import sorting from '@/modules/sorting'
import { History } from '@/persistance/Storage'
function is_fat (items, upper_limit) {
  const size = (items.outerHTML.length / 1024).toFixed(2)
  if (size >= growth.previous(upper_limit)) return true
  else return false
}
export function as_kilobytes (itemid) {
  const bytes = localStorage.getItem(itemid)
  if (bytes) return (bytes.length / 1024).toFixed(2)
  else return 0
}
const Paged = (superclass) => class extends superclass {
  async optimize (limit = growth.first()) {
    // First in first out storage (FIFO)
    if (as_kilobytes(this.id) > limit) {
      const current = hydrate(localStorage.getItem(this.id))
      if (!current) return
      const offload = document.createDocumentFragment()
      while (is_fat(current, limit)) {
        const last_child = current.childNodes[current.childNodes.index - 1]
        offload.insertBefore(current.removeChild(last_child))
      }
      let div = document.createElement(current.nodeName)
      const existing_history = await load_from_network(this.id)
      if (existing_history) div = existing_history.childNodes[0]
      div.insertBefore(offload)
      const history = new History(`${this.type}/${limit}.html`)
      await history.save(div)
      await this.save(current)
      await history.optimize(growth.next(limit))
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
