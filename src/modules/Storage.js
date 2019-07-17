import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import growth from '@/modules/growth'
const networkable = ['person', 'posts']
function keep_going(current_items, limit) {
  const current_size = current_items.outerHTML.length / 1024
  if (current_size >= growth.previous(limit)) {
    const item = Item.get_first_item(current_items)
    const today = new Date().setHours(0, 0, 0, 0)
    const created_at = Date.parse(item.created_at)
    if (created_at && created_at < today) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}
class Storage {
  static hydrate(item_as_string) {
    if (item_as_string) {
      return document.createRange().createContextualFragment(item_as_string)
    } else {
      return document.createDocumentFragment()
    }
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
    if (bytes) return (bytes.length / 1024).toFixed(0);
    else return 0;
  }
  async from_network() {
    if (networkable.includes(this.type)) {
      try {
        const url = await this.get_download_url()
        return Storage.hydrate(await (await fetch(url)).text())
      } catch(e) {
        if(e.code === 'storage/object-not-found') return null;
        else console.log(e.code);
      }
    } else return null;
  }
  from_local(name = this.name){
    const storage_string = localStorage.getItem(name)
    if (storage_string) return Storage.hydrate(storage_string);
    else return null;
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
      const current = (await this.from_storage(this.name)).childNodes[0]
      const offload = document.createDocumentFragment()
      while (keep_going(current, limit)) {
        const first_child = current.childNodes[0]
        offload.appendChild(current.removeChild(first_child))
      }
      const div = document.createElement(current.nodeName)
      div.setAttribute('itemprop', this.type)
      const history = new Storage(this.type, this.selector, `${this.type}.${limit}`)
      const existing_history = await history.from_storage()
      if (existing_history) div = existing_history.childNodes[0];
      div.appendChild(offload)
      await history.save(div)
      await this.save(current)
      // save yourself after the history file saves successfully
      // this helps prevent data loss when there is a process failure
      await history.optimize(growth.next(limit))
    }
    return Promise.resolve('Optimized')
  }
  persist(items, name = this.filename) {
    return new Promise((resolve, reject) => {
      firebase.auth().onAuthStateChanged(user => {
        if (user && navigator.onLine) {
          const file = new File([items], name)
          const path = `/people/${user.phoneNumber}/${name}`
          firebase.storage().ref().child(path).put(file, this.metadata)
          .then(message => resolve(message)).catch(error => reject(error))
        } else {
          resolve('offline')
        }
      })
    })
  }
  async save(items = document.querySelector(this.selector)) {
    if (!items) return;
    localStorage.setItem(this.name, items.outerHTML)
    if (networkable.includes(this.type)) {
      await this.persist(items.outerHTML)
    }
  }
  get_download_url() {
    return new Promise((resolve, reject) => {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          const doc_u_path = `/people/${user.phoneNumber}/${this.filename}`
          firebase.storage().ref().child(doc_u_path)
            .getDownloadURL()
            .then(url => resolve(url))
            .catch(e => reject(e))
        } else {
          reject(new Error('you must be signed in to get a download url'))
        }
      })
    })
  }
  async sync_list() {
    let from_server = await this.from_network()
    let local = await this.as_list()
    from_server = Item.get_items(from_server)
    let filtered_local = local.filter(local_item => {
      return !from_server.some(server_item => {
        return local_item.created_at === server_item.created_at
      })
    })
    let items = [...filtered_local, ...from_server]
    items.sort((a, b) => {
      return Date.parse(a.created_at) - Date.parse(b.created_at)
    })
    return items
  }
  async next_list(limit = growth.first()) {
    console.log('next_list')
    const history = new Storage(this.type, this.selector, `${this.type}.${limit}`)
    return await history.as_list()
  }
}
export default Storage
export const person_storage = new Storage('person')
export var posts_storage = new Storage('posts', '[itemprop=posts]')
export const relations_storage = new Storage('relations', '[itemprop=relations]')
