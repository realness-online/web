// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import profile from '@/helpers/profile'
import Item from '@/modules/item'
import Paged from '@/storage/Paged'
import Large from '@/storage/Large'
import Cloud from '@/storage/Cloud'
class Storage {
  constructor(type,
              selector = `[itemprop="${type}"]`,
              filename = `${type}/index`) {
    this.type = type
    this.selector = selector
    this.filename = filename
    this.metadata = { 'contentType': 'text/html' }
  }
  as_kilobytes() {
    const bytes = localStorage.getItem(this.selector)
    if (bytes) return (bytes.length / 1024).toFixed(2)
    else return 0
  }
  as_list() {
    return Item.get_items(localStorage.getItem(this.selector))
  }
  as_object() {
    return Item.get_first_item(localStorage.getItem(this.selector))
  }
  async save(items = document.querySelector(this.selector)) {
    if (!items) return
    localStorage.setItem(this.selector, items.outerHTML)
  }
}
class Person extends Cloud(Storage) {
  constructor() {
    super('person', '[itemtype="/person"]', 'index')
  }
  save() {
    const item_id = profile.from_e64(firebase.auth().currentUser.phoneNumber)
    const items = document.querySelector(`[itemid="${item_id}"]`)
    if (items) super.save(items)
    else super.save()
  }
}
class Posts extends Paged(Cloud(Storage)) {
  constructor() {
    super('posts', '[itemprop="posts"]')
  }
  save() {
    const items = document.querySelector(this.selector)
    if (items) super.save(items)
    else super.save()
  }
}
class SVG extends Large(Cloud(Storage)) {}

class Avatar extends SVG {
  constructor() {
    super('avatars', '[itemtype="/avatars"]')
  }
}

export default Storage
export class History extends Cloud(Storage) {
  constructor(item_id) {
    const type = item_id.split('/')[0]
    super(type, `[itemid="${item_id}"]`, item_id)
  }
}
export const relations_storage = new Storage('relations')
export const person_storage = new Person()
export const posts_storage = new Posts()
export const avatars_storage = new Avatar()
export const posters_storage = new SVG('posters')
