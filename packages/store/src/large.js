import { get, set, del } from 'idb-keyval'

/**
 * Large mixin: the item's html is cached in idb, and the directory row keeps the
 * created_at list in step. The app decides where the item lives; this mixin only
 * asks `paths`.
 * @param {{ paths: import('./store.js').Paths, itemid: import('@realness.online/itemid').Itemid }} config
 */
export const create_large =
  ({ paths, itemid }) =>
  superclass =>
    class extends superclass {
      constructor(...args) {
        super(...args)
      }

      /**
       * @returns {Promise<string>}
       */
      get_storage_path() {
        return paths.storage_path(this.id)
      }

      /**
       * @param {Element | {outerHTML: string}} [items]
       */
      async save(
        items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined
      ) {
        if (!items) return
        await set(this.id, items.outerHTML)
        const path = paths.directory_id(this.id)
        const directory = await get(path)
        const created_at = itemid.as_created_at(this.id)
        if (created_at)
          if (directory && directory.items) {
            if (!directory.items.includes(created_at)) {
              directory.items.push(created_at)
              await set(path, directory)
            }
          } else {
            const new_directory = {
              id: path,
              types: [],
              archive: [],
              items: [created_at]
            }
            await set(path, new_directory)
          }

        await super.save(items)
      }

      async delete() {
        await super.delete()
        const path = paths.directory_id(this.id)
        const directory = await get(path)
        await del(this.id)
        await Promise.all(paths.siblings(this.id).map(id => del(id)))
        if (directory?.items) {
          directory.items = directory.items.filter(
            id => parseInt(id) !== itemid.as_created_at(this.id)
          )
          await set(path, directory)
        }
      }
    }
