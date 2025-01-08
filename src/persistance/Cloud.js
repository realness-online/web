// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { current_user, upload, remove } from '@/use/serverless'
import { get, set, del } from 'idb-keyval'
import { load, as_filename, load_directory_from_network } from '@/utils/itemid'
import { prepare_upload_html } from '@/utils/upload_processor'
import { SIZE } from '@/utils/numbers'
const networkable = ['person', 'statements', 'posters', 'events']

export const Cloud = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }

    async to_network(items) {
      if (navigator.onLine && current_user.value) {
        const path = as_filename(this.id)
        const { compressed, metadata } = await prepare_upload_html(items)
        const response = await upload(path, compressed, metadata)

        if (response && response.status !== 304)
          await set(`hash:${this.id}`, metadata.customMetadata.hash)

        return response
      } else if (current_user.value || localStorage.me)
        await sync_later(this.id, 'save')
    }
    async save(items = document.querySelector(`[itemid="${this.id}"]`)) {
      console.info('request:save', this.id, items)
      if (!items || !items.outerHTML) return
      if (super.save) await super.save(items)
      if (networkable.includes(this.type))
        await this.to_network(items.outerHTML)
    }
    async delete() {
      console.info('request:delete', this.id)
      if (navigator.onLine && current_user.value) {
        const path = as_filename(this.id)
        await remove(path)
        await del(`hash:${this.id}`)
      } else await sync_later(this.id, 'delete')

      if (super.delete) await super.delete()
    }

    /**
     * Optimize the directory by moving older items to sub directories
     * @returns {Promise<void>}
     */
    async optimize() {
      if (super.optimize) await super.optimize()

      const directory_list = await load_directory_from_network(this.id)
      if (!directory_list?.items) return
      let { items } = directory_list
      if (items?.length > SIZE.MAX) {
        items = items.sort((a, b) => b - a)
        const index = items.length - 1 // get the oldest id
        const archive_directory = items[index] //becomes the name of the archive
        const archive = []
        while (archive.length < SIZE.MID) {
          const oldest = items.pop()
          if (await move_file(this.type, oldest, archive_directory))
            archive.push(oldest)
          else break
        }

        // if (items.length > SIZE.MAX) await this.optimize(), maybe we let this happen slowly over time
      }
    }
  }

export default Cloud

const move_file = async (type, id, archive_id) => {
  let upload_successful = false
  const local_id = `${localStorage.me}/${type}/${id}`
  const old_id = `${localStorage.me}/${type}/${id}`
  const new_id = `${localStorage.me}/${type}/${archive_id}/${id}`
  let html = await get(local_id)
  if (!html) {
    // if it isn't found loocally we need to download it
    html = await load(local_id)
    html = await get(local_id)
  }
  const { compressed, metadata } = await prepare_upload_html(html)
  try {
    // Step 1: Upload to new location
    await upload(as_filename(new_id), compressed, metadata)
    upload_successful = true

    // Step 2: Only remove old file if upload was successful
    await remove(as_filename(old_id))
    await del(old_id)
    await set(new_id, html)
    console.info(`Moved ${old_id} to ${new_id}`)
    return true
  } catch (error) {
    // Step 3: Cleanup if upload succeeded but remove failed
    if (upload_successful)
      try {
        await remove(as_filename(new_id))
        await set(old_id, html)
        console.log(`Rolled back upload of ${new_id}`)
      } catch (cleanup_error) {
        console.error(`Failed to cleanup ${new_id}`, cleanup_error)
      }

    console.error(`Failed to move poster ${old_id}`, error)
    return false
  }
}

export async function sync_later(id, action) {
  const offline = (await get('sync:offline')) || []
  offline.push({
    id,
    action
  })
  await set('sync:offline', offline)
}
