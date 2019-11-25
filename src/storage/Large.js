// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
let Large = (superclass) => class extends superclass {
  async as_network_list() {
    const items = []
    const directory = await this.directory()
    await directory.items.forEach(async (item) => {
      const url = await firebase.storage().ref().child(item.fullPath).getDownloadURL()
      const items_as_text = await (await fetch(url)).text()
      items.push(Item.get_first_item(items_as_text))
    })
    return items
  }
  async directory() {
    const items = []
    const user = firebase.auth().currentUser
    const storage = firebase.storage().ref()
    if (user && navigator.onLine) {
      const path = `/people/${user.phoneNumber}/${this.type}`
      return storage.child(path).listAll()
    }
    return items
  }
}
export default Large
