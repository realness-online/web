// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { set, get, del } from 'idb-keyval'
import { as_directory_id, as_created_at } from '@/utils/itemid'

const Large = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }

    async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
      if (!items) {
        console.info(`Unable to find ${this.id}`)
        return
      }
      await set(this.id, items.outerHTML)
      const path = as_directory_id(this.id)
      await del(path)
      if (super.save) await super.save(items)
    }
    async delete() {
      const path = as_directory_id(this.id)
      const directory = await get(path)
      await del(this.id)
      await del(path)
      if (directory?.items) {
        directory.items = directory.items.filter(
          id => parseInt(id) !== as_created_at(this.id)
        )
        await set(path, directory)
      }
      if (super.delete) await super.delete()
    }
  }
export default Large
