// https://developers.caffeina.com/object-composition-patterns-in-javascript-4853898bb9d0
import { recent_item_first } from '@/utils/sorting'
import { current_user } from '@/use/serverless'
import { get_item, hydrate, get_itemprops } from '@/utils/item'
import { from_e64 } from '@/use/people'
import { History } from '@/persistance/Storage'
import {
  list,
  type_as_list,
  load_from_network,
  load_directory_from_network,
  as_created_at
} from '@/utils/itemid'
import {
  SIZE,
  itemid_as_kilobytes,
  elements_as_kilobytes
} from '@/utils/numbers'

export const get_oldest = (elements, prop_name) => {
  const list = get_itemprops(elements)
  const props = list[prop_name]
  props.sort(recent_item_first)
  const oldest = props[props.length - 1]
  return new Date(as_created_at(oldest.id))
}

export const is_fat = (items, prop_name) => {
  const today = new Date().setHours(0, 0, 0, 0)
  if (
    elements_as_kilobytes(items) > SIZE.MIN &&
    get_oldest(items, prop_name) < today
  )
    return true
  return false
}

const Paged = superclass =>
  class extends superclass {
    constructor(...args) {
      super(...args)
    }

    async optimize() {
      console.log('optimize', this.id)

      if (this.type === 'posters') {
        const directory_data = await load_directory_from_network(this.id)
        if (!directory_data || directory_data.items.length <= SIZE.MAX) return
        const current_items = directory_data.items.slice(0, SIZE.MID)
        const archive_items = directory_data.items.slice(SIZE.MAX)

        // Handle posters as directory entries
        const archive_batches = []
        for (let i = 0; i < archive_items.length; i += SIZE.MAX) {
          const batch = archive_items.slice(i, i + SIZE.MAX)
          const newest_in_batch = Math.max(
            ...batch.map(item => item.created_at)
          )
          const archive_path = `${directory_path}${newest_in_batch}/`

          await set(archive_path, {
            items: batch.map(item => item.created_at),
            count: batch.length
          })

          archive_batches.push({
            path: archive_path,
            timestamp: newest_in_batch,
            count: batch.length
          })
        }

        // Update directory metadata
        await set(directory_path, {
          items: current_items.map(item => item.created_at),
          has_more: true,
          archives: archive_batches.sort((a, b) => b.timestamp - a.timestamp)
        })
      } else if (itemid_as_kilobytes(this.id) > SIZE.MAX) {
        const current = get_itemprops(hydrate(localStorage.getItem(this.id)))
        console.log('current', current)
        const oldest = get_oldest(current, this.type)

        const directory_path = `${this.id}/`
        const all_items = Array.from(current.childNodes)
          .map(node => {
            console.log('node', node)
            const id = node.getAttribute('itemid')
            const created_at = new Date(as_created_at(id)).getTime()

            console.log('created_at', created_at)
            return {
              node,
              created_at
            }
          })
          .sort((a, b) => b.created_at - a.created_at)
          .sort((a, b) => b.created_at - a.created_at)

        const current_items = all_items.slice(0, SIZE.MID)
        const archive_items = all_items.slice(SIZE.MAX)
        // Handle statements and other types as single files
        const archive_batches = []
        for (let i = 0; i < archive_items.length; i += SIZE.MAX) {
          const batch = archive_items.slice(i, i + SIZE.MAX)
          const newest_in_batch = Math.max(
            ...batch.map(item => item.created_at)
          )
          const archive_path = `${directory_path}${newest_in_batch}/`

          // Create archive document
          const archive_div = document.createElement(current.nodeName)
          archive_div.setAttribute('itemscope', '')
          archive_div.setAttribute('itemid', archive_path)
          batch.forEach(item => archive_div.appendChild(item.node))

          // Save archive as file
          const history = new History(archive_path)
          await history.save(archive_div)

          archive_batches.push({
            path: archive_path,
            timestamp: newest_in_batch,
            count: batch.length
          })

          current.innerHTML = ''
          current_items.forEach(item => current.appendChild(item.node))
          await this.save(current)
        }

        if (all_items.length > SIZE.MAX)
          if (this.type === 'posters') {
          } else {
          }

        // Update main collection
      }
    }
    async sync() {
      let oldest_at = 0 // the larger the number the more recent it is
      let cloud = await load_from_network(this.id)
      if (cloud) cloud = type_as_list(cloud).sort(recent_item_first)
      else cloud = []
      if (cloud.length > 0) {
        const oldest_id = cloud[cloud.length - 1].id
        oldest_at = as_created_at(oldest_id)
      }

      let local = await list(this.id)
      local.sort(recent_item_first)
      local = local.filter(local_item => {
        const created_at = as_created_at(local_item.id)
        if (oldest_at > created_at) return false // local older items are ignored, have been optimized away
        return !cloud.some(
          server_item =>
            // remove local items that are in the cloud
            local_item.id === server_item.id
        )
      })

      let offline = localStorage.getItem(`/+/${this.type}`)
      offline = type_as_list(get_item(offline))
      offline.forEach(item => {
        // convert id's to current id
        const me = from_e64(current_user.value.phoneNumber)
        item.id = `${me}/${this.type}/${as_created_at(item.id)}`
      })

      // three distinct lists are recombined into a single synced list
      const items = [...local, ...cloud, ...offline]
      items.sort(recent_item_first)

      return items
    }
  }
export default Paged
