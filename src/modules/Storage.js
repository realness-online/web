import Item from '@/modules/Item'

class Storage {
  // Always retrieve from document or localstorage.
    // do not track state. state is document.
      // if no document then localStorage
      // if not localstorage then network
  constructor(item_type,
              selector = `[itemtype="${item_type}"]`,
              location = `/${item_type}.html`) {
    this.item_type = item_type
    this.selector = selector
    this.location = location
  }

  from_storage() {
    let storage_string = localStorage.getItem(this.item_type)
    return Storage.hydrate(storage_string)
  }

  get_items() {
    let items = Item.get_items(this.from_storage())
    // console.log('get_items().length', items.length, items)
    return items
  }

  save() {
    // save assumes that vue has created components on the page that represent
    // the entirtiy of the data to be saved
    let items = document.querySelector(this.selector)
    // console.log('storage.save() items', items)
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
export const posts_storage = new Storage('http://schema.org/SocialMediaPosting', '[itemprop=posts]')
export const activity_storage = new Storage('/activity', '[itemprop=activity]')
