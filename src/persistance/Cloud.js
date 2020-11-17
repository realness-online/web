// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import { as_filename } from '@/helpers/itemid'
import { get, set } from 'idb-keyval'
const networkable = ['person', 'statements', 'posters', 'avatars', 'events']
async function sync_later (id, action) {
  const offline = (await get('offline')) || []
  offline.push({
    id,
    action
  })
  await set('offline', offline)
}
export const Cloud = (superclass) => class extends superclass {
  async to_network (items) {
    if (navigator.onLine) {
      const storage = firebase.storage()
      const user = firebase.auth().currentUser
      const path = as_filename(this.id)
      const file = new File([items], path)
      if (user) await storage.ref().child(path).put(file, this.metadata)
    } else sync_later(this.id, 'save')
  }
  async save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    console.info('request:save', this.id, items)
    if (!items) return
    if (super.save) super.save(items)
    if (networkable.includes(this.type)) this.to_network(items.outerHTML)
  }
  async delete () {
    console.info('request:delete', this.id)
    if (navigator.onLine) {
      const storage = firebase.storage().ref()
      const user = firebase.auth().currentUser
      const path = as_filename(this.id)
      if (user) await storage.child(path).delete()
    } else sync_later(this.id, 'delete')
    if (super.delete) super.delete()
  }
}
export default Cloud
