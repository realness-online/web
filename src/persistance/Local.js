// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { get, set } from 'idb-keyval'
import hash_code from '@/modules/hash'
const Local = (superclass) => class extends superclass {
  async save (items = document.querySelector(`[itemid="${this.id}"]`)) {
    let index = await get('hash')
    if (!index) index = {}
    if (items) {
      console.log('local:save')
      const content = items.outerHTML
      localStorage.setItem(this.id, content)
      const hash = hash_code(localStorage.getItem(this.id))
      index[this.id] = hash
      await set('hash', index)
    }
  }
}
export default Local
