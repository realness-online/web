 // https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import 'firebase/storage'
import profile from '@/helpers/profile'
import Item from '@/modules/item'
import Paged from '@/persistance/Paged'
import Large from '@/persistance/Large'
import Cloud from '@/persistance/Cloud'
class Storage {
  constructor(type, selector = `[itemprop="${type}"]`) {
    this.type = type
    this.selector = selector
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
export default Storage
export class Person extends Cloud(Storage) {
  constructor() {
    super('person', '[itemtype="/person"]', 'index')
  }
  save() {
    const item_id = profile.from_e64(firebase.auth().currentUser.phoneNumber)
    const items = document.querySelector(`[itemid="${item_id}"]`)
    if (items) super.save(items)
  }
}
export class Posts extends Paged(Cloud(Storage)) {
  constructor() {
    super('posts')
  }
  save() {
    const items = document.querySelector(this.selector)
    if (items) super.save(items)
  }
}
export class History extends Paged(Cloud(Storage)) {
  constructor(item_id) {
    const type = item_id.split('/')[0]
    super(type, `[itemid="${item_id}"]`, item_id)
  }
}
export class SVG extends Large(Cloud(Storage)) {}
export class Avatar extends SVG {
  constructor() {
    super('avatars', '[itemtype="/avatars"]')
  }
}
export class Activity extends Cloud(Storage) {
  constructor() {
    super('activity', '[itemtype="/activity"]', `activity/${new Date().toISOString()}`)
  }
  async save(items = document.querySelector(this.selector)) {
    if (navigator.onLine) {
      const file = new File([items.outerHTML], name)
      const path = `${this.filename}.html`
      await firebase.storage().ref().child(path).put(file, this.metadata)
    }
  }
}
export const relations_storage = new Storage('relations')
export const person_storage = new Person()
export const posts_storage = new Posts()
export const avatars_storage = new Avatar()
export const posters_storage = new SVG('posters')
