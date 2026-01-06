/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { Local } from '@/persistance/Local'
import { Large } from '@/persistance/Large'
import { Cloud } from '@/persistance/Cloud'
import { Paged } from '@/persistance/Paged'
import { current_user, upload, me } from '@/utils/serverless'
import {
  as_type,
  as_filename,
  as_created_at,
  as_query_id,
  is_itemid,
  load_from_network
} from '@/utils/itemid'
import { prepare_upload_html } from '@/utils/upload-processor'
import { del, get } from 'idb-keyval'

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
   * @param {Element | {outerHTML: string}} [items]
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

/**
 * @extends {Storage}
 */
class Cached_Storage extends Large(Cloud(Storage)) {
  async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
    super.save(items)

    if (navigator.onLine && current_user.value) {
      // After successful network save, prefetch from network to populate HTTP cache
      await load_from_network(this.id)
      await del(this.id)
    }
  }
}

/**
 * @extends {Storage}
 */
export class Poster extends Large(Cloud(Storage)) {}

/**
 * @extends {Cached_Storage}
 */
export class Cutout extends Cached_Storage {}

/**
 * @extends {Cached_Storage}
 */
export class Shadow extends Cached_Storage {}

/**
 * @extends {Storage}
 */
export class Me extends Cloud(Local(Storage)) {
  constructor() {
    super(localStorage.me)
  }

  async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
    if (!current_user.value) return
    if (!me.value) return
    if (!me.value.name || me.value.name.length < 3) return
    if (!me.value.visited) return
    await super.save(items)
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
    const outer_html = await get(this.id)
    if (!outer_html) return

    let { id } = this
    if (id.startsWith('/+/'))
      id = /** @type {Id} */ (
        `${localStorage.me}/${as_type(id)}/${as_created_at(id)}`
      )
    if (!is_itemid(id)) {
      console.error('invalid itemid', id)
      return
    }

    const temp_container = document.createElement('div')
    temp_container.innerHTML = outer_html

    const content = temp_container.firstElementChild
    if (content) {
      content.setAttribute('itemid', id)
      content.id = as_query_id(id)
    }

    this.id = id
    await super.save({ outerHTML: temp_container.innerHTML })
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
