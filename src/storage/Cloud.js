// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
const networkable = ['person', 'posts', 'posters', 'avatars']
async function get_download_url(person_id, item_id) {
  const path = `/people${person_id}/${item_id}`
  // console.info(path)
  try {
    return await firebase.storage().ref().child(path).getDownloadURL()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(path, e.code)
      return null
    } else throw e
  }
}
let Cloud = (superclass) => class extends superclass {
  async get_download_url() {
    const user = firebase.auth().currentUser
    if (user) {
      return await get_download_url(`/${user.phoneNumber}`, this.filename)
    } else return null
  }
  async from_network() {
    if (networkable.includes(this.type)) {
      const url = await this.get_download_url()
      if (url) return Item.hydrate(await (await fetch(url)).text())
    }
    return null
  }
  async save(items = document.querySelector(`[itemid="${this.filename}"]`)) {
    if (super.save) super.save()
    console.log('cloud save', this.filename);
    if (!items) return

    if (networkable.includes(this.type)) {
      this.persist(items.outerHTML)
    }
  }
  async delete() {
    // save the current state of the document to localstorage
    if (super.save) super.save()
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      const path = `people/${user.phoneNumber}/${this.filename}`
      await firebase.storage().ref().child(path).delete()
    }
  }
  async persist(items, name = this.filename) {
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      const file = new File([items], name)
      const path = `people/${user.phoneNumber}/${name}`
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
}
export default Cloud
export { get_download_url }
