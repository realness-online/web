import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import growth from '@/modules/growth'

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
  from_storage(name = this.name) {
    const storage_string = localStorage.getItem(name)
    return Storage.hydrate(storage_string)
  }
  as_list() {
    return Item.get_items(this.from_storage())
  }
  as_object() {
    return Item.get_first_item(this.from_storage())
  }
  async optimize(limit = growth.first()) {
    if (this.as_kilobytes() > limit) {
      const current = this.from_storage(this.name).childNodes[0]
      const offload = document.createDocumentFragment()

      while (keep_going(current, limit)) {
        const first_child = current.childNodes[0]
        offload.appendChild(current.removeChild(first_child))
      }

      await this.save(current)

      const history_name = `${this.type}.${limit}`
      const wayback = new Storage(this.type, this.selector, history_name)

      let history = localStorage.getItem(history_name)
      if (history) {
        history = this.from_storage(history_name).childNodes[0]
        console.log('if (history)', history, history.childNodes.length)
      } else {
        history = document.createElement(current.nodeName)
        history.setAttribute('itemprop', this.type)
      }
      history.appendChild(offload)

      await wayback.save(history)
      await wayback.optimize(growth.next(limit))
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
  save(items = document.querySelector(this.selector)) {
    return new Promise((resolve, reject) => {
      if (!items) resolve('nothing to save');
      localStorage.setItem(this.name, items.outerHTML)
      if (['person', 'posts'].includes(this.type)) {
        this.persist(items.outerHTML).then(message => resolve(message))
      } else {
        resolve('nothing to save')
      }
    })
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
  sync_list() {
    return new Promise((resolve, reject) => {
      this.get_download_url().then(url => {
        fetch(url).then(response => {
          response.text().then(server_text => {
            const server_as_fragment = Storage.hydrate(server_text)
            let from_server = Item.get_items(server_as_fragment)
            let filtered_local = this.as_list().filter(local_item => {
              return !from_server.some(server_item => {
                return local_item.created_at === server_item.created_at
              })
            })
            let items = [...filtered_local, ...from_server]
            items.sort((a, b) => {
              return Date.parse(a.created_at) - Date.parse(b.created_at)
            })
            resolve(items)
          })
        })
      })
    })
  }
  next_list(limit = growth.first()) {
    const history_name = `${this.type}.${limit}`
    return Item.get_items(this.from_storage(history_name))
  }
}
export default Storage
export const person_storage = new Storage('person')
export var posts_storage = new Storage('posts', '[itemprop=posts]')
export const relations_storage = new Storage('relations', '[itemprop=relations]')
