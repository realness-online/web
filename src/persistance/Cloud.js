// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { current_user, upload, remove } from '@/use/serverless'
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
      if (navigator.onLine && current_user.value) {
        const path = as_filename(this.id)
        this.metadata.customMetadata = { md5: hash(items, hash_options) }
        return upload(path, items, this.metadata)
      } else await sync_later(this.id, 'save')
    }
    async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
      console.log('request:save', this.id, items)
      if (!items || !items.outerHTML) return
      if (super.save) await super.save(items)
      if (networkable.includes(this.type)) {
        console.log('to the network')
        await this.to_network(items.outerHTML)
      }
    }
    async delete() {
      console.info('request:delete', this.id)
      if (navigator.onLine && current_user.value) {
        const path = as_filename(this.id)
        await remove(path)
      } else await sync_later(this.id, 'delete')
      if (super.delete) await super.delete()
    }
  }
export default Cloud
