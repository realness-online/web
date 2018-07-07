import Item from '@/modules/Item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'

class Storage {
  static hydrate(item_as_string) {
    return document.createRange().createContextualFragment(item_as_string)
  }
  constructor(item_type, selector = `[itemtype="/${item_type}"]`,
    filename = `${item_type}.html`) {
    this.item_type = item_type
    this.selector = selector
    this.filename = filename
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
    // save the information to local storage and if appropriate to the server
    let items = document.querySelector(this.selector)
    if (!items) { return false }
    items = items.outerHTML
    localStorage.setItem(this.item_type, items)
    if (['person', 'posts'].includes(this.item_type)) {
      this.persist(items)
    }
    return true
  }
  sync() {
    // check if an 'item_type'.html already exist for this user.
    // If so merge it's content whith what's stored locally
    const url = this.get_server_file_url()
    if (['person', 'posts'].includes(this.item_type) && navigator.onLine) {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          const doc_u_path = `/people/${user.phoneNumber}/${this.filename}`
          firebase.storage().ref().child(doc_u_path).getDownloadURL().then((url) => {
            fetch(url).then(response => {
              response.text().then(server_text => {
                const server_as_fragment = Storage.hydrate(server_text)
                let server_as_list = Item.get_items(server_as_fragment)
                console.log(server_as_list)
              })
              let items = [...this.from_storage, ...from_server]
              // console.log(items)
            })
          })
        }
      })
    }
  }

  get_server_file_url() {

  }

  persist(doc_u_ment, doc_u_path) {
    firebase.auth().onAuthStateChanged(user => {
      if (user && navigator.onLine) {
        const file = new File([doc_u_ment], this.filename)
        if (!doc_u_path) {
          doc_u_path = `/people/${user.phoneNumber}/${this.filename}`
        }
        firebase.storage().ref()
          .child(doc_u_path)
          .put(file, this.metadata)
          .catch(console.log.bind(console))
      }
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
