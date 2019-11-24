// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import Item from '@/modules/item'
import Paged from '@/storage/Paged'
import Large from '@/storage/Large'
import Cloud from '@/storage/Cloud'

class Storage {
  constructor(type,
              selector = `[itemprop="/${type}"]`,
              filename = `${type}/index.html`,
              content_type = 'text/html') {
    this.type = type
    this.selector = selector
    this.filename = filename
    this.metadata = { 'contentType': content_type }
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
    super('person', '[itemid="person.html"]', 'person.html')
  }
}
class Post extends Paged(Cloud(Storage)) {
  constructor() {
    super('posts')
  }
}
class SVG extends Large(Cloud(Storage)) {}

export default Storage
export const relations_storage = new Storage('relations')
export const person_storage = new Person()
export const posts_storage = new Posts()
export const avatars_storage = new SVG('avatars')
export const posters_storage = new SVG('posters')
