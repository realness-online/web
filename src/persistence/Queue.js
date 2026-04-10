/** @typedef {import('@/types').Id} Id */

import { get, set, del, keys } from 'idb-keyval'

/**
 * @typedef {Object} QueueItem
 * @property {Id} id
 * @property {Id} itemid
 * @property {Blob | ArrayBuffer | null} resized_blob
 * @property {'pending' | 'processing' | 'complete' | 'error'} status
 * @property {string} [svg_html]
 * @property {number} progress
 * @property {number} width
 * @property {number} height
 */

/**
 * @param {Id} id
 * @returns {string}
 */
const queue_key = id => `queue:posters:${id}`

/**
 * Convert Blob to ArrayBuffer for Safari compatibility
 * @param {Blob} blob
 * @returns {Promise<ArrayBuffer>}
 */
const blob_to_array_buffer = blob => {
  if (blob instanceof ArrayBuffer) return Promise.resolve(blob)
  return blob.arrayBuffer()
}

/**
 * Convert ArrayBuffer back to Blob
 * @param {ArrayBuffer} array_buffer
 * @returns {Blob}
 */
const array_buffer_to_blob = array_buffer => {
  if (array_buffer instanceof Blob) return array_buffer
  return new Blob([array_buffer], { type: 'image/jpeg' })
}

/**
 * @param {QueueItem} item
 * @returns {Promise<void>}
 */
export const add = async item => {
  const item_to_store = { ...item }
  if (item_to_store.resized_blob instanceof Blob)
    item_to_store.resized_blob = await blob_to_array_buffer(
      item_to_store.resized_blob
    )
  await set(queue_key(item.id), item_to_store)
}

/**
 * @returns {Promise<QueueItem | null>}
 */
export const get_next = async () => {
  const all_keys = await keys()
  const queue_keys = all_keys.filter(key =>
    String(key).startsWith('queue:posters:')
  )

  // Sequential check required: return first pending item found
  for (const key of queue_keys) {
    // eslint-disable-next-line no-await-in-loop
    const item = await get(key)
    if (item?.status === 'pending') {
      if (item.resized_blob instanceof ArrayBuffer)
        item.resized_blob = array_buffer_to_blob(item.resized_blob)
      return item
    }
  }
  return null
}

/**
 * @param {Id} id
 * @param {Partial<QueueItem>} updates
 * @returns {Promise<void>}
 */
export const update = async (id, updates) => {
  const key = queue_key(id)
  const item = await get(key)
  if (item) {
    const updates_to_store = { ...updates }
    if (
      updates_to_store.resized_blob &&
      updates_to_store.resized_blob instanceof Blob
    )
      updates_to_store.resized_blob = await blob_to_array_buffer(
        updates_to_store.resized_blob
      )
    await set(key, { ...item, ...updates_to_store })
  }
}

/**
 * @param {Id} id
 * @returns {Promise<void>}
 */
export const remove = async id => {
  await del(queue_key(id))
}

/**
 * @returns {Promise<QueueItem[]>}
 */
export const get_all = async () => {
  const all_keys = await keys()
  const queue_keys = all_keys.filter(key =>
    String(key).startsWith('queue:posters:')
  )

  const items = await Promise.all(queue_keys.map(key => get(key)))
  const valid_items = items.filter(item => item !== null)

  return valid_items
    .map(item => {
      if (item.resized_blob instanceof ArrayBuffer)
        item.resized_blob = array_buffer_to_blob(item.resized_blob)
      return item
    })
    .sort((a, b) => {
      const a_time = parseInt(a.id.split('/').pop())
      const b_time = parseInt(b.id.split('/').pop())
      return a_time - b_time
    })
}

/**
 * @param {Id} id
 * @returns {Promise<QueueItem | null>}
 */
export const get_item = async id => {
  const item = await get(queue_key(id))
  if (item && item.resized_blob instanceof ArrayBuffer)
    item.resized_blob = array_buffer_to_blob(item.resized_blob)
  return item
}
