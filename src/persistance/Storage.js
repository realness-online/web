// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Local from '@/persistance/Local'
import Large from '@/persistance/Large'
import Cloud from '@/persistance/Cloud'
import Paged from '@/persistance/Paged'
import { current_user } from '@/use/serverless'
import { as_type } from '@/use/itemid'
import { get } from 'idb-keyval'
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
    if (!items) return
    if (current_user.value && navigator.onLine) {
      const path = `/people/${this.id}.html`
      await location(path).putString(items.outerHTML, 'raw', this.metadata)
    }
  }
}
