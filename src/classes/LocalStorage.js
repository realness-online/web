import Storage from '@/classes/Storage'
import Item from '@/modules/item'

// because sometimes you just wanna work with the on device data
class LocalStorage extends Storage {
  constructor(type,
              selector = `[itemtype="/${type}"]`,
              filename = `${type}/index.html`,
              content_type = 'text/html') {
    super(type, selector, filename, content_type)
  }
  as_list() {
    return Item.get_items(this.from_local())
  }
  as_object() {
    return Item.get_first_item(this.from_local())
  }
}
export default LocalStorage
export const person_local = new LocalStorage('person')
export const posts_local = new LocalStorage('posts', '[itemprop=posts]')
export const relations_local = new LocalStorage('relations', '[itemprop=relations]')
