// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
const networkable = ['person', 'posts', 'posters', 'avatars', 'events']
async function get_download_url (itemid) {
  const path = `/people${itemid}.html`
  try {
    return await firebase.storage().ref().child(path).getDownloadURL()
  } catch (e) {
    if (e.code === 'storage/object-not-found') {
      console.warn(path)
      return null
    } else throw e
  }
}
const Cloud = (superclass) => class extends superclass {
  constructor (type,
              selector = `[itemprop="${type}"]`,
              filename = `${type}/index`) {
    super(type, selector)
    this.filename = filename
  }
  async get_download_url () {
    const user = firebase.auth().currentUser
    if (user) {
      return get_download_url(`/${user.phoneNumber}/${this.filename}`)
    } else return null
  }
  async from_network () {
    if (networkable.includes(this.type)) {
      const url = await this.get_download_url()
      if (url) return Item.hydrate(await (await fetch(url)).text())
    }
    return null
  }
  async save (items = document.querySelector(`[itemid="${this.filename}"]`)) {
    console.info('Cloud.save()', this.selector, this.filename, items)
    if (super.save) super.save()
    if (!items) return
    if (networkable.includes(this.type)) this.persist(items.outerHTML)
  }
  async delete () {
    // if (super.save) super.save() // save the current state of the document to localstorage
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      const path = `people/${this.filename}.html`
      await firebase.storage().ref().child(path).delete()
    }
  }
  async persist (items, filename = this.filename) {
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      const file = new File([items], filename)
      const path = `people/${filename}.html`
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
}
export default Cloud
export { get_download_url }
