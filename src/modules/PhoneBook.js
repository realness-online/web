import Storage, {person_storage} from '@/modules/Storage'
import Item from '@/modules/Item'
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
      this.as_list().then(people => {
        let me = person_storage.as_object()
        console.log('me to start', me.updated_at, me.first_name)
        let index = people.findIndex(contact => (contact.mobile === me.mobile))
        let phonebook_me = people[index]
        if (phonebook_me) {
          console.log('found me in the phonebook')
          console.log(me.updated_at, me.first_name)
          console.log(phonebook_me.updated_at, phonebook_me.first_name)
          if (phonebook_me.updated_at < me.updated_at) {
            localStorage.setItem('save-phonebook', 'true')
            console.log('updating me in the phonebook')
            people[index] = me
          }
        } else {
          localStorage.setItem('save-phonebook', 'true')
          console.log(`adding ${me.mobile} to phonebook`)
          people.push(me)
        }
        resolve(people)
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
