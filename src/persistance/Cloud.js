// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import hash from 'object-hash'
import { get, set } from 'idb-keyval'
import { as_filename } from '@/use/itemid'

const networkable = ['person', 'statements', 'posters', 'avatars', 'events']
export const hash_options = { encoding: 'base64', algorithm: 'md5' }

export async function sync_later(id, action) {
  const offline = (await get('sync:offline')) || []
  offline.push({
    id,
    action
  })
  await set('sync:offline', offline)
}

export const Cloud = superclass =>
  class extends superclass {
    async to_network(items) {
      const user = firebase.auth().currentUser
      if (navigator.onLine && user) {
        const storage = firebase.storage()
        const path = as_filename(this.id)
        this.metadata.customMetadata = {
          md5: hash(items, hash_options)
        }
        await storage.ref().child(path).putString(items, 'raw', this.metadata)
      } else await sync_later(this.id, 'save')
    }
    async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
      console.info('request:save', this.id, items)
      if (!items || !items.outerHTML) return
      if (super.save) await super.save(items)
      if (networkable.includes(this.type))
        await this.to_network(items.outerHTML)
    }
    async delete() {
      console.info('request:delete', this.id)
      const user = firebase.auth().currentUser
      if (navigator.onLine && user) {
        const storage = firebase.storage().ref()
        const path = as_filename(this.id)
        await storage.child(path).delete()
      } else await sync_later(this.id, 'delete')
      if (super.delete) await super.delete()
    }
  }

export default Cloud
