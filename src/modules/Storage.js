import Item from '@/modules/Item'

class Storage {
  constructor(item_type) {
    this.item_type = item_type
  }

  load() {
    let storage_string = localStorage.getItem(this.item_type)
    if (!storage_string) { return [] }
    let items = Storage.hydrate(storage_string)
    return items.getItems(this.item_type);
  }

  save() {
    let items = document.querySelector(`[itemtype="${this.item_type}"]`)
    if (!items) { return }
    items = items.outerHTML
    return localStorage.setItem(this.item_type, items)
  }

  static hydrate(item_as_string) {
    let items = document.createRange().createContextualFragment(item_as_string)
    items.getItems = Item.get_items
    return items
  }
}

export default Storage
export const posts_storage = new Storage('http://schema.org/SocialMediaPosting')
export const activity_storage = new Storage('/activity')
