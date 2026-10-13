/** @fileoverview Folder sync mixin - enqueue local thought exports after persist. */

/** @typedef {import('@/types').Id} Id */

import { as_poster_id, as_type } from '@/utils/itemid'
import { sync_folder as sync_folder_pref } from '@/utils/preference'

const folder_sync_itemid = id => {
  const poster_id = as_poster_id(id)
  if (poster_id) return poster_id
  const typ = as_type(id)
  if (typ === 'posters' || typ === 'thoughts') return id
  return null
}

/**
 * @template {new (...args: any[]) => any} T
 * @param {T} superclass
 * @returns {T}
 */
export const Folder = superclass =>
  class extends superclass {
    async save(
      items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined
    ) {
      await super.save(items ?? undefined)
      if (!sync_folder_pref.value) return
      const itemid = folder_sync_itemid(/** @type {Id} */ (this.id))
      if (!itemid) return
      const { enqueue_folder_sync } = await import('@/use/sync-folder')
      await enqueue_folder_sync(itemid, 'save')
    }

    async delete() {
      await super.delete()
      if (!sync_folder_pref.value) return
      const itemid = folder_sync_itemid(/** @type {Id} */ (this.id))
      if (!itemid) return
      const { enqueue_folder_sync } = await import('@/use/sync-folder')
      await enqueue_folder_sync(itemid, 'delete')
    }
  }

export default Folder
