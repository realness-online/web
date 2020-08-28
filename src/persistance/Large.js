// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import * as firebase from 'firebase/app'
import 'firebase/auth'
import { set, get } from 'idb-keyval'
import { as_directory_id, as_path_parts } from '@/helpers/itemid'
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
    // set items to be synced when back online of after sign-in
    if (!navigator.online || !firebase.auth().currentUser) {
      localStorage.setItem(this.id, null)
    }
    if (super.save) super.save(items)
  }
}
export default Large
