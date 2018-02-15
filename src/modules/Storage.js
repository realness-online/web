import Item from '@/modules/Item'

class Storage {
  // Always retrieve from document or localstorage.
    // do not track state. state is document.
      // if no document then localStorage
      // if not localstorage then network
  constructor(item_type,
              selector = `[itemtype="/${item_type}"]`,
              location = `/${item_type}.html`) {
    this.item_type = item_type
    this.selector = selector
    this.location = location

    // a cohort of users is a managable unit of users
      // user history.
      // a global setting
    this.cohort = 1
  }

  from_storage() {
    let storage_string = localStorage.getItem(this.item_type)
    return Storage.hydrate(storage_string)
  }

  get_items() {
    let items = Item.get_items(this.from_storage())
    console.log('get_items().length', items.length, items)
    return items
  }

  get_item() {
    let item = Item.get_items(this.from_storage())[0]
    console.log('get_items()', item)
    if (item) {
      return item
    } else {
      return {}
    }
  }

  save() {
    // save assumes that vue has created components on the page that represent
    // the entirtiy of the data to be saved
    let items = document.querySelector(this.selector)
    console.log('storage.save() items', items, this.selector)
    if (!items) { return false }
    items = items.outerHTML
    localStorage.setItem(this.item_type, items)
    return true
  }
  static hydrate(item_as_string) {
    return document.createRange().createContextualFragment(item_as_string)
  }
}
export default Storage
export const person_storage = new Storage('person')
export const posts_storage = new Storage('posts', '[itemprop=posts]')
export const activity_storage = new Storage('activity', '[itemprop=activity]')
