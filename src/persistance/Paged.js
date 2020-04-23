// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Item from '@/modules/item'
import { load, load_from_network } from '@/helpers/itemid'
import growth from '@/modules/growth'
import sorting from '@/modules/sorting'
import { History } from '@/persistance/Storage'
function keep_going (current_items, limit) {
  const current_size = current_items.outerHTML.length / 1024
  if (current_size >= growth.previous(limit)) {
    const item = Item.get_first_item(current_items)
    const today = new Date().setHours(0, 0, 0, 0)
    const created_at = Date.parse(item.created_at)
    if (created_at && created_at < today) return true // never trim today's stuff
    else return false
  } else return false
}
const Paged = (superclass) => class extends superclass {
  async optimize (limit = growth.first()) {
    // First in first out storage (FIFO)
    if (this.as_kilobytes() > limit) {
      const current = await load(this.id)
      const offload = document.createDocumentFragment()
      let oldest = null
      while (keep_going(current, limit)) {
        const last_child = current.childNodes[current.childNodes.index - 1]
        if (!oldest)
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
    const cloud_items = await load_from_network(this.id, '/+16282281824')
    const local_items = await load(this.id, '/+16282281824')
    const length = cloud_items.length
    if (length) oldest_at = Date.parse(cloud_items[length - 1].created_at)
    if (local_items.length) {
      const new_local_stuff = local_items.filter(local_item => {
        const created_at = Date.parse(local_item.created_at)
        // local older items are ignored, probably optimized away
        if (oldest_at > created_at) return false
        return !cloud_items.some(server_item => {
          return local_item.created_at === server_item.created_at
        })
      })
      items = [...new_local_stuff, ...cloud_items]
      items.sort(sorting.newer_first)
    } else items = cloud_items
    return items
  }
}
export default Paged


// async sync_list () {
//   const from_server = Item.get_items(await this.from_network())
//   const local_items = this.as_list()
//   // the larger the number the more recent it is
//   let oldest_date = 0
//   if (from_server.length) oldest_date = Date.parse(from_server[0].created_at)
//   let items
//   if (local_items.length > 0) {
//     const filtered_local = local_items.filter(local_item => {
//       const current_date = Date.parse(local_item.created_at)
//       if (oldest_date > current_date) return false
//       return !from_server.some(server_item => {
//         return local_item.created_at === server_item.created_at
//       })
//     })
//     items = [...filtered_local, ...from_server]
//     items.sort(sorting.older_first)
//   } else {
//     items = from_server
//   }
//   return items
// }
// }
