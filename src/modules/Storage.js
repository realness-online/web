import Item from '@/modules/Item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'

class Storage {
  static hydrate(item_as_string) {
    return document.createRange().createContextualFragment(item_as_string)
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
        this.persist(items)
          .then(resolve('saved local & network'))
          .catch(e => reject(e))
      } else {
        resolve('saved local')
      }
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
            .then(() => resolve(doc_u_path))
            .catch(e => reject(e))
        } else {
          resolve('no need to persist')
        }
      })
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
}

class PhoneBook extends Storage {
  constructor() {
    super('phonebook', '#phonebook')
  }
  get_download_url() {
    return new Promise((resolve, reject) => {
      firebase.storage().ref().child('/people/index.html')
        .getDownloadURL()
        .then(url => resolve(url))
        .catch(e => reject(e))
    })
  }
  as_list() {
    return new Promise((resolve, reject) => {
      this.get_download_url().then(url => {
        fetch(url).then(response => {
          response.text().then(server_text => {
            const server_as_fragment = Storage.hydrate(server_text)
            resolve(Item.get_items(server_as_fragment))
          })
        })
      })
    })
  }
  update(me) {
    return new Promise((resolve, reject) => {
      this.as_list().then(people => {
        let index = people.findIndex(contact => me.mobile === contact.mobile)
        let same = people[index]
        if (same) {
          console.log('found me in the phonebook')
          if (same.updated_at < me.updated_at) {
            console.log('updating phonebook with new info', same, me)
            people[index] = me
          }
          resolve(people)
        } else {
          console.log(`adding ${me.mobile} to phonebook`)
          people.push(me)
        }
        resolve(people)
      })
    })
  }
}
export default Storage
export const person_storage = new Storage('person')
export const posts_storage = new Storage('posts', '[itemprop=posts]')
export const activity_storage = new Storage('activity', '[itemprop=activity]')
export const relations_storage = new Storage('relations', '[itemprop=relations]')
export const phonebook_storage = new PhoneBook()

//  use this for firebase logging
// .then( snapshot => {
//   console.log('Uploaded', snapshot.totalBytes, 'bytes.')
//   console.log(snapshot.metadata)
//   console.log(snapshot.fullPath)
//   console.log('File available at', snapshot.downloadURL)
// })
