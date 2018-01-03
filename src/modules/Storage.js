import Item from '@/modules/Item'

class Storage {
  constructor(item_prop, item_type) {
    this.itemprop = item_prop
    this.itemtype = item_type
  }

  save() {
    let items = document.querySelector(`[itemprop="${this.itemprop}"]`)
    if (!items) { return }
    items = items.innerHTML
    localStorage.setItem(this.itemprop, items)
  }

  load() {
    let storage_string = localStorage.getItem(this.itemprop)
    if (!storage_string) { return [] }
    let items = Storage.hydrate(storage_string)
    return items.getItems(this.itemtype)
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
