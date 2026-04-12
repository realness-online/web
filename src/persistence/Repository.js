/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */

import { as_type } from '@/utils/itemid'

/**
 * @interface
 */
export class Storage {
  /**
   * @type {Object}
   */
  metadata = { contentType: 'text/html' }

  /**
   * @param {Id} itemid
   */
  constructor(itemid) {
    this.id = itemid
    this.type = as_type(itemid)
  }

  /**
   * @param {Element | {outerHTML: string} | null} [items]
   */
  save(items) {}
  delete() {}
  /**
   * @returns {Promise<Item[]>}
   */
  sync() {
    return Promise.resolve([])
  }
  optimize() {}
}
