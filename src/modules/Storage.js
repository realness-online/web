import Item from '@/modules/Item'
import firebase from 'firebase'
class Storage {
  constructor(item_type,
    selector = `[itemtype="/${item_type}"]`, location = `${item_type}.html`) {
    this.item_type = item_type
    this.selector = selector
    this.location = location
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
    let items = document.querySelector(this.selector)
    if (!items) { return false }
    items = items.outerHTML
    localStorage.setItem(this.item_type, items)
    this.persist(items)
    return true
  }

  persist(doc_u_ment) {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        const file = new File([doc_u_ment], this.location)
        if (navigator.online) {
          firebase.storage().ref()
            .child(`/cohorts/1/people/${user.uid}/${this.location}`)
            .put(file, this.metadata)
            .catch(console.log.bind(console))
        } else {
          console.log(`You are offline. ${this.item_type} saved to localStorage`)
        }
      }
    })
  }

  static hydrate(item_as_string) {
    return document.createRange().createContextualFragment(item_as_string)
  }
}

export default Storage
export const person_storage = new Storage('person')
export const posts_storage = new Storage('posts', '[itemprop=posts]')
export const activity_storage = new Storage('activity', '[itemprop=activity]')

//  use this for firebase logging
// .then( snapshot => {
//   console.log('Uploaded', snapshot.totalBytes, 'bytes.')
//   console.log(snapshot.metadata)
//   console.log(snapshot.fullPath)
//   console.log('File available at', snapshot.downloadURL)
// })
