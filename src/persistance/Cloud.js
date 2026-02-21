/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/persistance/Storage').Storage} Storage */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { current_user, upload, remove, move } from '@/utils/serverless'
import { get, set, del } from 'idb-keyval'
import { as_filename, as_type, as_path_parts, as_archive } from '@/utils/itemid'
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
  'relations',
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

const poster_component_types = [
  'shadows',
  'sediment',
  'sand',
  'gravel',
  'rocks',
  'boulders'
]

/**
 * @param {Id} poster_id
 * @returns {Promise<string[]>}
 */
const get_poster_delete_paths = async poster_id => {
  let base = poster_id.startsWith('/+') ? `people${poster_id}` : poster_id
  const archive = await as_archive(poster_id)
  if (archive) base = archive
  return [
    `${base}.html.gz`,
    ...poster_component_types.map(type => `${base}-${type}.html.gz`)
  ]
}

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
        const path =
          typeof this['get_storage_path'] === 'function'
            ? await this['get_storage_path']()
            : await as_filename(this.id)
        const { compressed, metadata } = await prepare_upload_html(items)
        const response = await upload(path, compressed, metadata)
        const directory = await as_directory(this.id)
        if (!directory) return response
        await del(directory.id)
        return response
      } else if (current_user.value || localStorage.me)
        await sync_later(this.id, 'save')
    }

    async save(
      items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined
    ) {
      if (!items || !items.outerHTML) return
      await super.save(items)
      const item_type = this.type || as_type(this.id)
      if (item_type && networkable.includes(item_type))
        await this.to_network(items.outerHTML)
    }

    async delete() {
      if (navigator.onLine && current_user.value) {
        const item_type = this.type || as_type(this.id)
        if (item_type === 'posters') {
          const paths = await get_poster_delete_paths(this.id)
          console.info('[poster:delete] transaction:', paths)
          await Promise.all(paths.map(path => remove(path)))
        } else {
          const path =
            typeof this['get_storage_path'] === 'function'
              ? await this['get_storage_path']()
              : await as_filename(this.id)
          await remove(path)
        }
      } else await sync_later(this.id, 'delete')

      super.delete()
    }

    /**
     * Optimize the directory by moving older items to sub directories
     * @returns {Promise<void>}
     */
    async optimize() {
      await super.optimize()
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
        const to_archive = sorted_items.splice(-SIZE.MID)
        const path = as_path_parts(this.id)
        const [author] = path
        let had_partial_failure = false

        const archive_poster = async timestamp => {
          if (item_type === 'posters' && author) {
            const component_types = [
              'shadows',
              'sediment',
              'sand',
              'gravel',
              'rocks',
              'boulders'
            ]
            const move_promises = [
              {
                type: item_type,
                promise: move(
                  item_type,
                  timestamp,
                  archive_directory,
                  `/${author}`
                )
              },
              ...component_types.map(component_type => ({
                type: component_type,
                promise: move(
                  component_type,
                  timestamp,
                  archive_directory,
                  `/${author}`
                )
              }))
            ]
            const results = await Promise.all(move_promises.map(m => m.promise))
            const failed = move_promises.filter((_, i) => !results[i])
            if (failed.length > 0) {
              if (failed.length < move_promises.length)
                had_partial_failure = true
              console.error(
                `[optimize] Failed to move components for poster ${timestamp}:`,
                failed.map(f => f.type)
              )
            }
            return results.every(success => success === true)
          }

          return move(item_type, timestamp, archive_directory, `/${author}`)
        }

        const run_batch = () => Promise.all(to_archive.map(archive_poster))

        let archive_results = await run_batch()
        let successfully_archived_count = archive_results.filter(
          success => success === true
        ).length

        if (successfully_archived_count === 0) {
          await load_directory_from_network(this.id)
          archive_results = await run_batch()
          successfully_archived_count = archive_results.filter(
            success => success === true
          ).length
        }

        if (successfully_archived_count > 0) {
          const check_directory = await load_directory_from_network(this.id)
          const check_items = check_directory?.items ?? []
          if (!had_partial_failure && check_items.length > SIZE.MAX)
            await this.optimize()
        }
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
