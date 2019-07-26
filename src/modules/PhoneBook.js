import Storage from '@/modules/Storage'
import { person_local } from '@/modules/LocalStorage'
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
  async get_download_url() {
    return firebase.storage().ref().child('/people/index.html').getDownloadURL()
  }
  async as_list() {
    const url = await this.get_download_url()
    const server_text = await (await fetch(url)).text()
    return Item.get_items(Storage.hydrate(server_text))
  }
  async sync_list() {
    let me = person_local.as_object()
    const people = await this.as_list()
    const user = firebase.auth().currentUser
    if (user) {
      me.id = profile_id.from_e64(user.phoneNumber)
      let index = people.findIndex(contact => (contact.id === me.id))
      if (index === -1) {
        localStorage.setItem('save-phonebook', 'true')
        people.push(me)
      }
    }
    return people
  }
  async save() {
    let items = document.querySelector(this.selector)
    if (items && navigator.onLine && firebase.auth().currentUser) {
      const storage = firebase.storage().ref()
      const phonebook = new File([items.outerHTML], 'index.html')
      const path = '/people/index.html'
      const url = await storage.child(path).put(phonebook, this.metadata)
      localStorage.removeItem('save-phonebook')
      return url
    } else return null
  }
}

export default PhoneBook
export const phonebook_storage = new PhoneBook()
