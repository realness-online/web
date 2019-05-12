import Storage, { person_storage } from '@/modules/Storage'
import profile_id from '@/modules/profile_id'
import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'

class PhoneBook extends Storage {
  constructor() {
    super('phonebook', '#phonebook')
    this.filename = 'index.html'
    this.itemtype = 'people'
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
      }).catch(e => resolve([]))
    })
  }
  sync_list() {
    return new Promise((resolve, reject) => {
      let me = person_storage.as_object()
      this.as_list().then(people => {
        firebase.auth().onAuthStateChanged(user => {
          if (user) {
            me.id = profile_id.from_e64(user.phoneNumber)
            let index = people.findIndex(contact => (contact.id === me.id))
            if (index === -1) {
              localStorage.setItem('save-phonebook', 'true')
              people.push(me)
            }
          }
          resolve(people)
        })
      })
    })
  }
  save() {
    return new Promise((resolve, reject) => {
      let items = document.querySelector(this.selector)
      if (!items) { resolve('nothing to save') }
      items = items.outerHTML
      this.persist(items, '/people/index.html').then(() => {
        localStorage.removeItem('save-phonebook')
        resolve('saved phonebook to server')
      }).catch(e => reject(e))
    })
  }
}

export default PhoneBook
export const phonebook_storage = new PhoneBook()
