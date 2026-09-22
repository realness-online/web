// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { del } from 'idb-keyval'

/**
 * The default document format: the html as it stands, typed as html. An app that
 * compresses or hashes passes `backend.serialize`.
 * @param {{outerHTML?: string} | string} items
 * @returns {{compressed: string, metadata: object}}
 */
const serialize_document = items => ({
  compressed: typeof items === 'string' ? items : (items.outerHTML ?? ''),
  metadata: { contentType: 'text/html' }
})

/**
 * Cloud mixin: writes go to the backend when online and signed in, into the
 * app's offline queue otherwise, and `optimize` pages older items into archive
 * directories as whole items (every file `paths.files` reports moves together).
 * @param {{
 *   backend: import('./store.js').Backend,
 *   paths: import('./store.js').Paths,
 *   vocabulary: import('./store.js').Vocabulary,
 *   itemid: import('@realness/itemid').Itemid,
 *   as_directory: (itemid: string) => Promise<{ id: string, items?: number[], archive?: number[] } | null>,
 *   load_directory_from_network: (itemid: string) => Promise<{ id: string, items?: number[], archive?: number[] } | null>
 * }} config
 */
export const create_cloud = ({
  backend,
  paths,
  vocabulary,
  itemid,
  as_directory,
  load_directory_from_network
}) => {
  const { networkable, archived } = vocabulary
  const online = () => backend.online()
  const signed_in = () => backend.signed_in()

  return superclass =>
    class extends superclass {
      constructor(...args) {
        super(...args)
      }

      async to_network(items) {
        if (online() && signed_in()) {
          const path = await paths.storage_path(this.id)
          const { compressed, metadata } = backend.serialize
            ? await backend.serialize(items)
            : serialize_document(items)
          const response = await backend.upload(path, compressed, metadata)
          await backend.after_upload?.(this.id, path, response)
          const directory = await as_directory(this.id)
          if (!directory) return response
          await del(directory.id)
          return response
        } else if (backend.later) await backend.later(this.id, 'save')
      }

      /**
       * @param {Element | {outerHTML: string}} [items]
       * @returns {Promise<unknown>} - a subclass may report success instead
       */
      async save(
        items = document.querySelector(`[itemid="${this.id}"]`) ?? undefined
      ) {
        if (!items || !items.outerHTML) return
        await super.save(items)
        const item_type = this.type || itemid.as_type(this.id)
        if (item_type && networkable.includes(item_type))
          await this.to_network(items)
      }

      async delete() {
        if (online() && signed_in()) {
          const files = await paths.files(this.id)
          await Promise.all(files.map(path => backend.remove(path)))
        } else if (backend.later) await backend.later(this.id, 'delete')

        super.delete()
      }

      /**
       * Move older items into archive directories, oldest first. Every file the
       * item owns moves as a unit: a partial move is rolled back so an item is
       * never split across live and archive.
       * @returns {Promise<void>}
       */
      async optimize() {
        await super.optimize()
        const item_type = this.type || itemid.as_type(this.id)
        if (!item_type || !archived.includes(item_type)) return

        const directory_list = await load_directory_from_network(this.id)
        if (!directory_list?.items) return
        const { items } = directory_list
        const { MAX, MID } = vocabulary.sizes
        if (items?.length > MAX) {
          const sorted_items = [...items].sort((a, b) => Number(b) - Number(a))
          const archive_directory = sorted_items[sorted_items.length - 1]
          const to_archive = sorted_items.splice(-MID)
          const [author] = itemid.as_path_parts(this.id)

          const archive_item = async timestamp => {
            const live_id = `${author}/${item_type}/${timestamp}`
            const archived_id = `${author}/${item_type}/${archive_directory}/${timestamp}`
            const [live_files, archived_files] = await Promise.all([
              paths.files(live_id),
              paths.files(archived_id, archive_directory)
            ])
            const pairs = live_files.map((from, i) => ({
              from,
              to: archived_files[i]
            }))
            const results = await Promise.all(
              pairs.map(pair => backend.move(pair.from, pair.to))
            )
            const succeeded = pairs.filter((_, i) => results[i])
            const failed = pairs.filter((_, i) => !results[i])
            if (failed.length > 0 && succeeded.length > 0) {
              // Partial failure: undo the files that did move so this item
              // stays fully consistent (un-archived) instead of split across
              // both locations.
              await Promise.all(
                succeeded.map(pair => backend.move(pair.to, pair.from))
              )
              console.error(
                `[optimize] Rolled back partial archive for ${archived_id}:`,
                failed.length
              )
              return false
            }
            if (failed.length > 0)
              console.error(`[optimize] Failed to move ${live_id}`)
            return results.every(success => success === true)
          }

          const run_batch = () => Promise.all(to_archive.map(archive_item))

          let archive_results = await run_batch()
          let successfully_archived_count = archive_results.filter(
            success => success === true
          ).length

          if (successfully_archived_count === 0) {
            await load_directory_from_network(this.id)
            archive_results = await run_batch()
            successfully_archived_count = archive_results.filter(
              success => success === true
            ).length
          }

          if (successfully_archived_count > 0) {
            const check_directory = await load_directory_from_network(this.id)
            const check_items = check_directory?.items ?? []
            if (check_items.length > MAX) await this.optimize()
          }
        }
      }
    }
}
