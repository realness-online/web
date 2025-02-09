/** @typedef {import('@/types').Id} Id */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { Local } from '@/persistance/Local'
import { Large } from '@/persistance/Large'
import { Cloud } from '@/persistance/Cloud'
import { Paged } from '@/persistance/Paged'
import { current_user, upload } from '@/utils/serverless'
import { as_type, as_filename } from '@/utils/itemid'
import { get } from 'idb-keyval'
import { prepare_upload_html } from '@/utils/upload-processor'

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

  save(_items) {}
  delete() {}
  sync() {}
  optimize() {}
}

/**
 * @extends {Storage}
 */
export class Poster extends Large(Cloud(Storage)) {}

/**
 * @extends {Storage}
 */
export class Me extends Cloud(Local(Storage)) {
  constructor() {
    super(localStorage.me)
  }
}

/** @extends {Storage} */
export class Relation extends Local(Storage) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/relations`))
  }
}

/** @extends {Storage} */
export class Statement extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/statements`))
  }
}

/** @extends {Storage} */
export class Event extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(/** @type {Id} */ (`${localStorage.me}/events`))
  }
}

/** @extends {Storage} */
export class Offline extends Cloud(Storage) {
  async save() {
    const outerHTML = await get(this.id)
    if (!outerHTML) return

    // Transform anonymous IDs to user IDs
    let target_id = this.id
    if (target_id.startsWith('/+/')) {
      const path_parts = target_id.split('/')
      // Remove the /+/ prefix and replace with user ID
      path_parts[1] = localStorage.me.replace('/', '')
      target_id = path_parts.join('/')
    }

    // Update the instance id to use the transformed id
    this.id = target_id
    await super.save({ outerHTML })
  }
}

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
