import Item from '@/modules/Item'

class Storage {
  constructor(item_prop, item_type) {
    this.itemprop = item_prop
    this.itemtype = item_type
  }

  load() {
    let storage_string = localStorage.getItem(this.itemprop)
    if (!storage_string) { return [] }
    let items = Storage.hydrate(storage_string)
    return items.getItems(this.itemtype)
  }

  save() {
    let items = document.querySelector(`[itemprop="${this.itemprop}"]`)
    if (!items) { return }
    items = items.innerHTML
    return localStorage.setItem(this.itemprop, items)
  }

  static hydrate(item_as_string) {
    let items = document.createRange().createContextualFragment(item_as_string)
    items.getItems = Item.get_items
    return items
  }
}

export default Storage
export const posts_storage = new Storage('posts', 'http://schema.org/SocialMediaPosting')
export const activity_storage = new Storage('activity', '/activity')
