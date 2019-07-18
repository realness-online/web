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
  async get_download_url() {
    return await firebase.storage().ref().child('/people/index.html').getDownloadURL()
  }
  async as_list() {
    const url = await this.get_download_url()
    const server_text = await (await fetch(url)).text()
    return Item.get_items(Storage.hydrate(server_text))
  }
  async sync_list() {
    let me = person_storage.as_object()
    const people = await this.as_list()
    firebase.auth().onAuthStateChanged(add_me_to_phonebook)
    return people
    function add_me_to_phonebook(firebase_user) {
      if (firebase_user) {
        me.id = profile_id.from_e64(firebase_user.phoneNumber)
        let index = people.findIndex(contact => (contact.id === me.id))
        if (index === -1) {
          localStorage.setItem('save-phonebook', 'true')
          people.push(me)
        }
      }
    }
  }
  async save() {
    let items = document.querySelector(this.selector)
    if (!items) return;
    items = items.outerHTML
    await this.persist(items, '/people/index.html')
    localStorage.removeItem('save-phonebook')
  }
}

export default PhoneBook
export const phonebook_storage = new PhoneBook()
