/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/persistance/Storage').Storage} Storage */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { current_user, upload, remove, move } from '@/utils/serverless'
import { get, set, del } from 'idb-keyval'
import { as_filename } from '@/utils/itemid'
import {
  load_directory_from_network,
  as_directory
} from '@/persistance/Directory'
import { prepare_upload_html } from '@/utils/upload-processor'
import { SIZE } from '@/utils/numbers'
const networkable = ['person', 'statements', 'posters', 'events']

/**
 * @template {new (...args: any[]) => Storage} T
 * @param {T} superclass
 * @returns {T}
 */
export const Cloud = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }

    async to_network(items) {
      if (navigator.onLine && current_user.value) {
        const path = await as_filename(this.id)
        const { compressed, metadata } = await prepare_upload_html(items)
        const response = await upload(path, compressed, metadata)
        const directory = await as_directory(this.id)

        await del(directory.id)

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
        const path = await as_filename(this.id)
        await remove(path)
      } else await sync_later(this.id, 'delete')

      if (super.delete) super.delete()
    }

    /**
     * Optimize the directory by moving older items to sub directories
     * @returns {Promise<void>}
     */
    async optimize() {
      if (super.optimize) await super.optimize()

      const directory_list = await load_directory_from_network(this.id)
      if (!directory_list?.items) return
      const { items } = directory_list
      if (items?.length > SIZE.MAX) {
        const sorted_items = items.sort((a, b) => Number(b) - Number(a))
        const index = sorted_items.length - 1
        const archive_directory = sorted_items[index]
        const archive = []
        const to_archive = sorted_items.splice(-SIZE.MID)
        const moves = to_archive.map(oldest =>
          move(this.type, oldest, archive_directory).then(
            success => success && archive.push(oldest)
          )
        )
        await Promise.all(moves)

        const check_directory = await load_directory_from_network(this.id)
        const { items: check_items } = check_directory

        if (check_items.length > SIZE.MAX) await this.optimize()
      }
    }
  }

export default Cloud

export async function sync_later(id, action) {
  const offline = (await get('sync:offline')) || []
  const exists = offline.some(item => item.id === id && item.action === action)
  if (!exists) {
    offline.push({ id, action })
    await set('sync:offline', offline)
  }
}
