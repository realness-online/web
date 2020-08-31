  // // https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { set, get, del } from 'idb-keyval'
import { as_directory_id, as_path_parts, as_created_at } from '@/helpers/itemid'
const Large = (superclass) => class extends superclass {
  async save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    const path = as_directory_id(this.id)
    let directory = await get(path)
    if (directory && directory.items) directory.items.push(as_path_parts(this.id)[2])
    else directory = { items: [as_path_parts(this.id)[2]] }
    if (items) {
      set(this.id, items.outerHTML)
      set(path, directory)
    }
    if (super.save) super.save(items)
  }
  async delete () {
    const path = as_directory_id(this.id)
    const directory = await get(path)
    directory.items = directory.items.filter(id => parseInt(id) !== as_created_at(this.id))
    del(this.id)
    set(path, directory)
  }
}
export default Large
