import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import growth from '@/modules/growth'
import sorting from '@/modules/sorting'
import Storage from '@/classes/Storage'
class LargeStorage extends Storage {
  constructor(itemid) {
    const item = itemid.split('/')
    const type = item[0]
    const name = item[1]
    const content_type = name.split('.')[1]
    super(type, `[itemprop="${type}"]`, itemid, content_type)
  }
  async from_storage(name = this.filename) {
    return this.from_local(name) || this.from_network()
  }
  async as_list() {
    const items = []
    const user = firebase.auth().currentUser
    const storage = firebase.storage().ref()
    if (user && navigator.onLine) {
      const path = `/people/${user.phoneNumber}/${this.type}`
      const directory = await storage.child(path).listAll()
      return directory.items
    }
    return items
  }
  async persist(items, name = this.filename) {
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      const file = new File([items], name)
      const path = `people/${user.phoneNumber}/${this.filename}`
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
  async delete() {
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      const path = `people/${user.phoneNumber}/${this.filename}`
      await firebase.storage().ref().child(path).delete()
    }
  }
  async save() {
    localStorage.setItem(this.type, document.querySelector(this.selector))
    const itemid = `[itemid="${this.filename}"]`
    return this.persist(document.querySelector(itemid))
  }
}
export default LargeStorage
export const avatars_storage = new LargeStorage('avatars/index.html')
export var posters_storage = new LargeStorage('posters/index.html')
