/** @typedef {import('@/types').Id} Id */

import { Cloud } from '@/persistence/Cloud'
import { Storage } from '@/persistence/Repository'
import { current_user, upload } from '@/utils/serverless'
import { prepare_upload_html } from '@/utils/upload-processor'
import { as_filename } from '@/utils/itemid'

/** @extends {Storage} */
export class History extends Cloud(Storage) {
  /**
   * @param {Id} itemid
   */
  constructor(itemid) {
    super(itemid)
    this.id = itemid
  }

  /** @param {Element | {outerHTML: string}} items */
  async save(items) {
    // on purpose doesn't call super.save
    if (!items) return false
    if (current_user.value && navigator.onLine) {
      const { compressed, metadata } = await prepare_upload_html(items)
      try {
        await upload(await as_filename(this.id), compressed, metadata)
      } catch (e) {
        console.error(e)
        return false
      }
      return true
    }
    return false
  }
}
