/** @typedef {import('@/types').Item_Id} Item_Id */

// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Local from '@/persistance/Local'
import Large from '@/persistance/Large'
import Cloud from '@/persistance/Cloud'
import Paged from '@/persistance/Paged'
import { current_user, upload } from '@/use/serverless'
import { as_type, as_filename } from '@/utils/itemid'
import { get } from 'idb-keyval'
import { prepare_upload_html } from '@/utils/upload_processor'

export default class Storage {
  /**
   * @param {Item_Id} itemid
   */
  constructor(itemid) {
    this.id = itemid
    this.type = as_type(itemid)
    this.metadata = { contentType: 'text/html' }
  }
}

/** @extends {Storage} */
export class Poster extends Large(Cloud(Storage)) {}

/** @extends {Storage} */
export class Me extends Cloud(Local(Storage)) {
  constructor() {
    super(localStorage.me)
  }
}

/** @extends {Storage} */
export class Relation extends Local(Storage) {
  constructor() {
    super(`${localStorage.me}/relations`)
  }
}

/** @extends {Storage} */
export class Statement extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(`${localStorage.me}/statements`)
  }
}

/** @extends {Storage} */
export class Event extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(`${localStorage.me}/events`)
  }
}

/** @extends {Storage} */
export class Offline extends Cloud(Storage) {
  async save() {
    const outerHTML = await get(this.id)
    if (outerHTML) await super.save({ outerHTML })
  }
}

/** @extends {Storage} */
export class History extends Cloud(Storage) {
  /**
   * @param {Item_Id} itemid
   */
  constructor(itemid) {
    super(itemid)
  }

  async save(items) {
    // on purpose doesn't call super.save
    if (!items) return false
    if (current_user.value && navigator.onLine) {
      const { compressed, metadata } = await prepare_upload_html(items)
      try {
        await upload(as_filename(this.id), compressed, metadata)
      } catch (e) {
        console.error(e)
        return false
      }
      return true
    }
    return false
  }
}
