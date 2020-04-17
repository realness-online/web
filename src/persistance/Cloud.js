// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Item from '@/modules/item'
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { download_url, as_filename } from '@/helpers/itemid'
import { del } from 'idb-keyval'
const networkable = ['person', 'posts', 'posters', 'avatars', 'events']
export const Cloud = (superclass) => class extends superclass {
  constructor (type,
              selector = `[itemprop="${type}"]`,
              filename = `${type}/index`) {
    super(type, selector)
    this.filename = filename
  }
  async from_network () {
    if (networkable.includes(this.type)) {
      const url = await download_url(this.id)
      if (url) return Item.hydrate(await (await fetch(url)).text())
    }
    return null
  }
  async to_network (items) {
    const user = firebase.auth().currentUser
    const path = as_filename(this.id)
    if (user && navigator.onLine) {
      const file = new File([items], path)
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
  async save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    console.info('Cloud.save()', this.id)
    if (super.save) super.save()
    if (!items) return
    if (networkable.includes(this.type)) this.to_network(items.outerHTML)
  }
  async delete () {
    const user = firebase.auth().currentUser
    if (user && navigator.onLine) {
      del(this.id)
      await firebase.storage().ref().child(as_filename(this.id)).delete()
    }
  }
}
export default Cloud
