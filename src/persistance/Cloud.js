/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/persistance/Storage').Storage} Storage */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { current_user, upload, remove, move } from '@/utils/serverless'
import { get, set, del } from 'idb-keyval'
import { as_filename, as_type, as_path_parts } from '@/utils/itemid'
import { has_archive } from '@/types'
import { mutex } from '@/utils/algorithms'
import {
  load_directory_from_network,
  as_directory
} from '@/persistance/Directory'
import { prepare_upload_html } from '@/utils/upload-processor'
import { SIZE } from '@/utils/numbers'
const networkable = [
  'person',
  'statements',
  'posters',
  'events',
  'shadows',
  'sediment',
  'sand',
  'gravel',
  'rocks',
  'boulders'
]

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
        // Use custom path if available (Large files use folder structure)
        const path =
          typeof this['get_storage_path'] === 'function'
            ? await this['get_storage_path']()
            : await as_filename(this.id)
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
      const item_type = this.type || as_type(this.id)
      if (networkable.includes(item_type))
        await this.to_network(items.outerHTML)
    }

    async delete() {
      console.info('request:delete', this.id)
      if (navigator.onLine && current_user.value) {
        const path =
          typeof this['get_storage_path'] === 'function'
            ? await this['get_storage_path']()
            : await as_filename(this.id)
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
      const item_type = this.type || as_type(this.id)
      if (
        !item_type ||
        !has_archive.includes(
          /** @type {typeof has_archive[number]} */ (item_type)
        )
      )
        return

      const directory_list = await load_directory_from_network(this.id)
      if (!directory_list?.items) return
      const { items } = directory_list
      if (items?.length > SIZE.MAX) {
        const sorted_items = items.sort((a, b) => Number(b) - Number(a))
        const index = sorted_items.length - 1
        const archive_directory = sorted_items[index]
        const archive = []
        const to_archive = sorted_items.splice(-SIZE.MID)
        const path = as_path_parts(this.id)
        const [author] = path

        const moves = to_archive.flatMap(timestamp => {
          const poster_move = move(
            item_type,
            timestamp,
            archive_directory,
            `/${author}`
          ).then(success => success && archive.push(timestamp))

          if (item_type === 'posters' && author) {
            const component_types = [
              'shadows',
              'sediment',
              'sand',
              'gravel',
              'rocks',
              'boulders'
            ]
            const component_moves = component_types.map(component_type =>
              move(
                component_type,
                timestamp,
                archive_directory,
                `/${author}`
              ).then(success => success && archive.push(timestamp))
            )
            return [poster_move, ...component_moves]
          }

          return [poster_move]
        })

        await Promise.all(moves)

        const check_directory = await load_directory_from_network(this.id)
        const { items: check_items } = check_directory
        if (check_items.length > SIZE.MAX) await this.optimize()
      }
    }
  }
export default Cloud

export async function sync_later(id, action) {
  await mutex.lock()
  const offline = (await get('sync:offline')) || []
  const exists = offline.some(item => item.id === id && item.action === action)
  if (!exists) {
    offline.push({ id, action })
    await set('sync:offline', offline)
  }
  mutex.unlock()
}
