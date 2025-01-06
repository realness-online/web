// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { current_user, upload, remove } from '@/use/serverless'
import { get, set, del } from 'idb-keyval'
import { as_filename, load_directory_from_network } from '@/utils/itemid'
import { prepare_upload_html } from '@/utils/upload_processor'
import { SIZE, to_kb } from '@/utils/numbers'
const networkable = ['person', 'statements', 'posters', 'events']

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
    constructor(...args) {
      super(...args)
    }

    async to_network(items) {
      if (navigator.onLine && current_user.value) {
        const path = as_filename(this.id)
        const { compressed, metadata } = await prepare_upload_html(items)
        console.group('upload')
        console.log('path', path)
        console.log('metadata', metadata)
        console.log('compressed', compressed)
        console.groupEnd()

        const response = await upload(path, compressed, metadata)

        if (response && response.status !== 304)
          await set(`hash:${this.id}`, metadata.customMetadata.hash)

        return response
      } else if (current_user.value || localStorage.me)
        await sync_later(this.id, 'save')
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
      if (navigator.onLine && current_user.value) {
        const path = as_filename(this.id)
        await remove(path)
        await del(`hash:${this.id}`)
      } else await sync_later(this.id, 'delete')

      if (super.delete) await super.delete()
    }

    /**
     * Optimize the directory by moving older items to sub directories
     * @returns {Promise<void>}
     */
    async optimize() {
      if (super.optimize) await super.optimize()

      const directory_list = await load_directory_from_network(this.id)

      if (directory_list?.items?.length > SIZE.MAX)
        console.log('directory needs to be pruned', to_kb(directory_list))

      // Add directory pruning logic here
    }
  }
export default Cloud
