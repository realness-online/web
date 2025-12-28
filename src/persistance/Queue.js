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

  // Sequential check required: return first pending item found
  for (const key of queue_keys) {
    // eslint-disable-next-line no-await-in-loop
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

  const items = await Promise.all(queue_keys.map(key => get(key)))
  const valid_items = items.filter(item => item !== null)

  return valid_items.sort((a, b) => {
    const a_time = parseInt(a.id.split('/').pop())
    const b_time = parseInt(b.id.split('/').pop())
    return a_time - b_time
  })
}

/**
 * @param {Id} id
 * @returns {Promise<QueueItem | null>}
 */
export const get_item = id => get(queue_key(id))
