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
  constructor(itemid) {
    this.id = itemid
    this.type = as_type(itemid)
    this.metadata = { contentType: 'text/html' }
  }
}

export class Poster extends Paged(Large(Cloud(Storage))) {}
export class Me extends Cloud(Local(Storage)) {
  constructor() {
    super(localStorage.me)
  }
}
export class Relations extends Local(Storage) {
  constructor() {
    super(`${localStorage.me}/relations`)
  }
}
export class Statements extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(`${localStorage.me}/statements`)
  }
}
export class Events extends Paged(Cloud(Local(Storage))) {
  constructor() {
    super(`${localStorage.me}/events`)
  }
}
export class Offline extends Cloud(Storage) {
  async save() {
    const outerHTML = await get(this.id)
    if (outerHTML) await super.save({ outerHTML })
  }
}
export class History extends Cloud(Storage) {
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
