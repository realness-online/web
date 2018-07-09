import Item from '@/modules/Item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'

class Storage {
  static hydrate(item_as_string) {
    return document.createRange().createContextualFragment(item_as_string)
  }
  static persist(doc_u_ment, doc_u_path) {
    return new Promise((resolve, reject) => {
      firebase.auth().onAuthStateChanged(user => {
        if (user && navigator.onLine) {
          const file = new File([doc_u_ment], this.filename)
          if (!doc_u_path) {
            doc_u_path = `/people/${user.phoneNumber}/${this.filename}`
          }
          firebase.storage().ref().child(doc_u_path).put(file, this.metadata)
            .then(() => resolve('persisted to network'))
            .catch(e => reject(e))
        } else {
          resolve('no need to persist')
        }
      })
    })
  }
  constructor(type, query = `[itemtype="/${type}"]`, file = `${type}.html`) {
    this.item_type = type
    this.selector = query
    this.filename = file
    this.metadata = {'contentType': 'text/html'}
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
  save() {
    return new Promise((resolve, reject) => {
      let items = document.querySelector(this.selector)
      if (!items) { resolve('nothing to save') }
      items = items.outerHTML
      localStorage.setItem(this.item_type, items)
      if (['person', 'posts'].includes(this.item_type)) {
        Storage.persist(items)
          .then(resolve('saved local & network'))
          .catch(e => reject(e))
      } else {
        resolve('saved local')
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
}

export default Storage
export const person_storage = new Storage('person')
export const posts_storage = new Storage('posts', '[itemprop=posts]')
export const activity_storage = new Storage('activity', '[itemprop=activity]')
export const relations = new Storage('relations', '[itemprop=relations]')
export const phonebook = new Storage('phonebook')

//  use this for firebase logging
// .then( snapshot => {
//   console.log('Uploaded', snapshot.totalBytes, 'bytes.')
//   console.log(snapshot.metadata)
//   console.log(snapshot.fullPath)
//   console.log('File available at', snapshot.downloadURL)
// })
