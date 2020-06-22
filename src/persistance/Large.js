// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { set } from 'idb-keyval'
const Large = (superclass) => class extends superclass {
  save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    if (items) set(this.id, items.outerHTML)
  }
}
export default Large
