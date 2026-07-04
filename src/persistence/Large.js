/** @typedef {import('@/types').Id} Id */
// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { set, get, del } from 'idb-keyval'
import {
  as_created_at,
  as_poster_id,
  as_layer_name,
  as_layer_id
} from '@/utils/itemid'
import { as_archive, as_directory_id } from '@/persistence/Directory'

/**
 * @template {new (...args: any[]) => any} T
 * @param {T} superclass
 * @returns {T}
 */
export const Large = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }

    /**
     * Get storage path for large files i
     * @returns {Promise<string>}
     */
    async get_storage_path() {
      let poster_id = as_poster_id(this.id)
      if (!poster_id && this.type === 'posters') poster_id = this.id
      if (poster_id) {
        let poster_filename = poster_id
        if (poster_id.startsWith('/+')) poster_filename = `people${poster_id}`

        const layer_name = as_layer_name(this.id)
        const archive = await as_archive(poster_id)

        if (archive) {
          if (layer_name) return `${archive}-${layer_name}.html.gz`
          return `${archive}.html.gz`
        }
        if (layer_name) return `${poster_filename}-${layer_name}.html.gz`
        return `${poster_filename}.html.gz`
      }

      let filename = this.id
      if (this.id.startsWith('/+')) filename = `people${this.id}`

      const archive = await as_archive(this.id)
      if (archive) return `${archive}.html.gz`

      return `${filename}.html.gz`
    }

    async save(
      items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined
    ) {
      if (!items) return
      await set(this.id, items.outerHTML)
      const path = as_directory_id(this.id)
      const directory = await get(path)
      const created_at = as_created_at(this.id)
      if (created_at)
        if (directory && directory.items) {
          if (!directory.items.includes(created_at)) {
            directory.items.push(created_at)
            await set(path, directory)
          }
        } else {
          const new_directory = {
            id: path,
            types: [],
            archive: [],
            items: [created_at]
          }
          await set(path, new_directory)
        }

      await super.save(items)
    }
    async delete() {
      await super.delete()
      const path = as_directory_id(this.id)
      const directory = await get(path)
      await del(this.id)
      // When deleting a poster, also purge local cached layer keys (shadow +
      // geology cutouts) so they don't linger and 404 on the next load.
      if (this.type === 'posters') {
        const layer_types = [
          'shadows',
          'sediment',
          'sand',
          'gravel',
          'rocks',
          'boulders'
        ]
        await Promise.all(
          layer_types.map(type => del(as_layer_id(this.id, type)))
        )
      }
      if (directory?.items) {
        directory.items = directory.items.filter(
          id => parseInt(id) !== as_created_at(this.id)
        )
        await set(path, directory)
      }
    }
  }
