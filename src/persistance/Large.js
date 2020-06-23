// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { set, get } from 'idb-keyval'
import { as_directory_path, as_filename } from '@/helpers/itemid'
const Large = (superclass) => class extends superclass {
  async save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    const path = as_directory_path(this.id)
    let directory = await get(path)
    if (directory && directory.items) directory.items.push(as_filename(this.id))
    else directory = { items: [as_filename(this.id)] }
    if (items) {
      set(this.id, items.outerHTML)
      set(path, directory)
    }
  }
}
export default Large
