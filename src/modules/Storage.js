import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import growth from '@/modules/growth'
import sorting from '@/modules/sorting'
const networkable = ['person', 'posts']
function keep_going(current_items, limit) {
  const current_size = current_items.outerHTML.length / 1024
  if (current_size >= growth.previous(limit)) return true
  else return false
}
// function keep_going(current_items, limit) {
//   const current_size = current_items.outerHTML.length / 1024
//   if (current_size >= growth.previous(limit)) {
//     const item = Item.get_first_item(current_items)
//     const today = new Date().setHours(0, 0, 0, 0)
//     const created_at = Date.parse(item.created_at)
//     if (created_at && created_at < today) return true
//     else return false
//   } else return false
// }
  class Storage {
  static async get_download_url(person_id, name) {
    const path = `/people${person_id}/${name}`
    // console.log(path)
    try {
      return await firebase.storage().ref().child(path).getDownloadURL()
    } catch (e) {
      if (e.code === 'storage/object-not-found') {
        console.warn(path, e.code)
        return null
      } else throw e
    }
  }
  static hydrate(item_as_string) {
    if (item_as_string) {
      return document.createRange().createContextualFragment(item_as_string)
    } else return null
  }
  constructor(type, selector = `[itemtype="/${type}"]`, name = type,
    filename = `${name}.html`, content_type = 'text/html') {
    this.type = type
    this.selector = selector
    this.filename = filename
    this.name = name
    this.metadata = { 'contentType': content_type }
  }
  as_kilobytes() {
    const bytes = localStorage.getItem(this.name)
    if (bytes) return (bytes.length / 1024).toFixed(0)
    else return 0
  }
  from_local(name = this.name) {
    const storage_string = localStorage.getItem(name)
    return Storage.hydrate(storage_string)
  }
  async get_download_url() {
    const user = firebase.auth().currentUser
    if (user) {
      return Storage.get_download_url(`/${user.phoneNumber}`, this.filename)
    } else return null
  }
  async from_network() {
    if (networkable.includes(this.type)) {
      const url = await this.get_download_url()
      if (url) {
        return Storage.hydrate(await (await fetch(url)).text())
      }
    }
    return null
  }
  async from_storage(name = this.name) {
    return this.from_local(name) || this.from_network()
  }
  async as_list() {
    return Item.get_items(await this.from_storage())
  }
  async as_object() {
    return Item.get_first_item(await this.from_storage())
  }
  async optimize(limit = growth.first()) {
    if (this.as_kilobytes() > limit) {
      console.log('optimize', this.filename, this.as_kilobytes())
      let current = (await this.from_network()).childNodes[0]
      const offload = document.createDocumentFragment()
      while (keep_going(current, limit)) {
        const first_child = current.childNodes[0]
        offload.appendChild(current.removeChild(first_child))
      }
      let div = document.createElement(current.nodeName)
      div.setAttribute('itemprop', this.type)
      const history = new Storage(this.type, this.selector, `${this.type}.${limit}`)
      const existing_history = await history.from_network()
      if (existing_history) div = existing_history.childNodes[0]
      div.appendChild(offload)
      await history.save(div)
      await this.save(current)
      await history.optimize(growth.next(limit))
    }
  }
  persist(items, name = this.filename) {
    return new Promise((resolve, reject) => {
      const user = firebase.auth().currentUser
      if (user && navigator.onLine) {
        const file = new File([items], name)
        const path = `/people/${user.phoneNumber}/${name}`
        firebase.storage().ref().child(path)
        .put(file, this.metadata)
        .then(url => resolve(url))
        .catch(error => reject(error))
      } else {
        resolve('offline')
      }
    })
  }
  async save(items = document.querySelector(this.selector)) {
    if (!items) return
    localStorage.setItem(this.name, items.outerHTML)
    if (networkable.includes(this.type)) {
      return this.persist(items.outerHTML)
    }
  }
  async sync_list() {
    let from_server = await this.from_network()
    from_server = Item.get_items(from_server)
    let items
    if (this.from_local()) {
      const local_items = Item.get_items(this.from_local())
      let filtered_local = local_items.filter(local_item => {
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
  async next_list(limit = growth.first()) {
    const history = new Storage(this.type, this.selector, `${this.type}.${limit}`)
    return history.as_list()
  }
}
export default Storage
export const person_storage = new Storage('person')
export var posts_storage = new Storage('posts', '[itemprop=posts]')
