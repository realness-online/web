/** @typedef {import('@/types').Id} Id */

import { get, set, del, keys } from 'idb-keyval'

/**
 * @typedef {Object} QueueItem
 * @property {Id} id
 * @property {Id} itemid
 * @property {Blob} resized_blob
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
 * @param {QueueItem} item
 * @returns {Promise<void>}
 */
export const add = async item => {
  await set(queue_key(item.id), item)
}

/**
 * @returns {Promise<QueueItem | null>}
 */
export const get_next = async () => {
  const all_keys = await keys()
  const queue_keys = all_keys.filter(key =>
    String(key).startsWith('queue:posters:')
  )

  for (const key of queue_keys) {
    const item = await get(key)
    if (item?.status === 'pending') return item
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
  if (item) await set(key, { ...item, ...updates })
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

  const items = []
  for (const key of queue_keys) {
    const item = await get(key)
    if (item) items.push(item)
  }

  return items.sort((a, b) => {
    const a_time = parseInt(a.id.split('/').pop())
    const b_time = parseInt(b.id.split('/').pop())
    return a_time - b_time
  })
}

/**
 * @param {Id} id
 * @returns {Promise<QueueItem | null>}
 */
export const get_item = async id => await get(queue_key(id))
