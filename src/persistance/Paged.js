// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Item from '@/modules/item'
import growth from '@/modules/growth'
import sorting from '@/modules/sorting'
import Storage, { History } from '@/persistance/Storage'
import Cloud from '@/persistance/Cloud'
function keep_going(current_items, limit) {
  const current_size = current_items.outerHTML.length / 1024
  if (current_size >= growth.previous(limit)) {
    const item = Item.get_first_item(current_items)
    const today = new Date().setHours(0, 0, 0, 0)
    const created_at = Date.parse(item.created_at)
    if (created_at && created_at < today) return true
    else return false
  } else return false
}

let Paged = (superclass) => class extends superclass {
  async optimize(limit = growth.first()) {
    if (this.as_kilobytes() > limit) {
      let current = Item.hydrate(localStorage.getItem(this.selector)).childNodes[0]
      const offload = document.createDocumentFragment()
      while (keep_going(current, limit)) {
        const first_child = current.childNodes[0]
        offload.appendChild(current.removeChild(first_child))
      }
      let div = document.createElement(current.nodeName)
      div.setAttribute('itemprop', this.type)
      const history = new History(`${this.type}/${limit}.html`)
      const existing_history = await history.from_network()
      if (existing_history) div = existing_history.childNodes[0]
      div.appendChild(offload)
      await history.save(div)
      await this.save(current)
      await history.optimize(growth.next(limit))
    }
  }
  async sync_list() {
    const from_server = Item.get_items(await this.from_network())
    const local_items = this.as_list()
    // the larger the number the more recent it is
    let oldest_date = 0
    if (from_server.length) oldest_date = Date.parse(from_server[0].created_at)
    let items
    if (local_items.length > 0) {
      let filtered_local = local_items.filter(local_item => {
        const current_date = Date.parse(local_item.created_at)
        if (oldest_date > current_date) return false
        return !from_server.some(server_item => {
          return local_item.created_at === server_item.created_at
        })
      })
      items = [...filtered_local, ...from_server]
      items.sort(sorting.older_first)
    } else {
      items = from_server
    }
    return items
  }
}
export default Paged
