// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { as_filename } from '@/helpers/itemid'
const networkable = ['person', 'statements', 'posters', 'avatars', 'events']
export const Cloud = (superclass) => class extends superclass {
  async to_network (items) {
    const user = firebase.auth().currentUser
    const path = as_filename(this.id)
    if (user && navigator.onLine) {
      const file = new File([items], path)
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
  async save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    console.info('Cloud.save()', this.id, items)
    if (!items) return
    if (super.save) super.save(items)
    if (networkable.includes(this.type)) this.to_network(items.outerHTML)
  }
  async delete () {
    console.info('Cloud.delete()', this.id)
    if (firebase.auth().currentUser && navigator.onLine) {
      await firebase.storage().ref().child(as_filename(this.id)).delete()
    }
  }
}
export default Cloud
