import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import fibonacci from '@/modules/fibonacci'
function keep_going(current_items) {
  const first = fibonacci.first()
  const shrink_too = first - fibonacci.next(first)
  const current_size = current_items.outerHTML.length / 1024
  if (current_size >= shrink_too) {
    const item = Item.get_first_item(current_items)
    const today = new Date().setHours(0, 0, 0, 0)
    const created_at = Date.parse(item.created_at)
    if (created_at && created_at < today ) return true;
    else return false;
  } else return false;

}
class Storage {
  static hydrate(item_as_string) {
    if (item_as_string) {
      return document.createRange().createContextualFragment(item_as_string)
    } else {
      return document.createDocumentFragment()
    }
  }
  static in_kb(bytes) {
    return (bytes / 1024).toFixed(0)
  }
  constructor(type,
    query = `[itemtype="/${type}"]`,
    file = `${type}.html`,
    content_type = 'text/html') {
    this.item_type = type
    this.selector = query
    this.filename = file
    this.metadata = { 'contentType': content_type }
  }
  as_kilobytes() {
    const bytes = localStorage.getItem(this.item_type)
    if (bytes) return (bytes.length / 1024).toFixed(0);
    else return 0;
  }
  from_storage() {
    let storage_string = localStorage.getItem(this.item_type)
    return Storage.hydrate(storage_string)
  }
  as_list() {
    return Item.get_items(this.from_storage())
  }
  as_object() {
    return Item.get_first_item(this.from_storage())
  }
  optimize() {
    return new Promise((resolve, reject) => {
      console.log(this.as_kilobytes())
      if (this.as_kilobytes() > fibonacci.first() ) {
        const name = `${this.item_type}.${fibonacci.first()}`
        const current_items = this.from_storage().childNodes[0]
        const offload_items = Storage.hydrate(localStorage.getItem(name))
        while (keep_going(current_items)) {
          console.log(Storage.in_kb(current_items.outerHTML.length))
          const first = current_items.childNodes[0]
          const in_transit = current_items.removeChild(first)
          offload_items.appendChild(in_transit)
        }
        localStorage.setItem(this.item_type, current_items.outerHTML)
        const next_document = document.createElement(current_items.nodeName)
        next_document.setAttribute('itemprop', this.item_type)
        next_document.appendChild(offload_items)
        localStorage.setItem(name, next_document.outerHTML)
        reject(name)
      }
    })

  }
  save() {
    return new Promise((resolve, reject) => {
      let items = document.querySelector(this.selector)
      if (!items) { resolve('nothing to save') }
      items = items.outerHTML
      localStorage.setItem(this.item_type, items)

      if (['person', 'posts'].includes(this.item_type)) {
        resolve('finished faker')
        // this.persist(items)
        //   .then(() => resolve(`saved ${this.item_type} locally and to network`))
        //   .catch(e => reject(e))
      } else {
        resolve('saved locally')
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
  persist(doc_u_ment, doc_u_path) {
    return new Promise((resolve, reject) => {
      firebase.auth().onAuthStateChanged(user => {
        if (user && navigator.onLine) {
          const file = new File([doc_u_ment], this.filename)
          if (!doc_u_path) {
            doc_u_path = `/people/${user.phoneNumber}/${this.filename}`
          }
          firebase.storage().ref().child(doc_u_path).put(file, this.metadata)
            .then((upload_task) => resolve(upload_task))
            .catch(e => reject(e))
        } else {
          resolve('Unable to persist to server')
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
}
export default Storage
export const person_storage = new Storage('person')
export const posts_storage = new Storage('posts', '[itemprop=posts]')
export const relations_storage = new Storage('relations', '[itemprop=relations]')
