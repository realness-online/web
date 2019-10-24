import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import growth from '@/modules/growth'
import sorting from '@/modules/sorting'
import Storage from '@/classes/Storage'
class LargeStorage extends Storage {
  constructor(type,
              selector = `[itemtype="/${type}"]`,
              filename = `${type}/${Date.now()}.html`,
              content_type = 'text/html') {
    super(type, selector, filename, content_type)
  }
  async from_storage(name = this.filename) {
    return this.from_local(name) || this.from_network()
  }
  async as_list() {
    const items = []
    const user = firebase.auth().currentUser
    const storage = firebase.storage().ref()
    if (user && navigator.onLine) {
      const path = `people/${user.phoneNumber}/${this.type}`
      const directory = await storage.child(path).listAll()
      return directory.items
    }
    return items
  }
  async as_object() {}
  async optimize(limit = growth.first()) {}
  async persist(items, name = this.filename) {
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      const file = new File([items], name)
      const path = `people/${user.phoneNumber}/${this.filename}`
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
  async save(items = document.querySelector(this.selector)) {
    if (!items) return
    return this.persist(items.outerHTML)
  }
  async sync_list() {
    const from_server = Item.get_items(await this.from_network())
    const local_items = Item.get_items(this.from_local())
    // the larger the number the more recent it is
    let oldest_date = 0
    if (from_server.length) oldest_date = Date.parse(from_server[0].created_at)
    let items
    if (local_items.length > 0) {
      const local_items = Item.get_items(this.from_local())
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
  async next_page(limit = growth.first()) {
    const history = new Storage(this.type, this.selector, `${this.type}.${limit}.html`)
    return history.as_list()
  }
}
 export default LargeStorage
export const avatars_storage = new LargeStorage('avatars')
export var posters_storage = new LargeStorage('posters')
