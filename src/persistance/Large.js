/** @typedef {import('@/persistance/Storage').Storage} Storage */
/** @typedef {import('@/types').Id} Id */
// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { set, get, del } from 'idb-keyval'
import { as_created_at, as_archive } from '@/utils/itemid'
import { as_directory_id } from '@/persistance/Directory'

/**
 * @template {new (...args: any[]) => Storage} T
 * @param {T} superclass
 * @returns {T}
 */
export const Large = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }

    /**
     * Get storage path for large files (uses folder structure)
     * @returns {Promise<string>}
     */
    async get_storage_path() {
      let filename = this.id
      if (this.id.startsWith('/+')) filename = `people${this.id}`

      // Check if this item is in an archive
      const archive = await as_archive(this.id)
      if (archive) return `${archive}/index.html.gz`

      // Large files use folder structure
      return `${filename}/index.html.gz`
    }

    async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
      console.log('save', this.id, items)
      debugger
      if (!items) {
        console.info(`Unable to find ${this.id}`)
        return
      }
      await set(this.id, items.outerHTML)
      const path = as_directory_id(this.id)
      const directory = await get(path)
      if (directory && directory.items) {
        const created_at = as_created_at(this.id)
        if (created_at && !directory.items.includes(created_at)) {
          directory.items.push(created_at)
          await set(path, directory)
        }
      }
      if (super.save) await super.save(items)
    }
    async delete() {
      const path = as_directory_id(this.id)
      const directory = await get(path)
      await del(this.id)
      if (directory?.items) {
        directory.items = directory.items.filter(
          id => parseInt(id) !== as_created_at(this.id)
        )
        await set(path, directory)
      }
      if (super.delete) await super.delete()
    }
  }
