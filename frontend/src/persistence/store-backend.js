/** @fileoverview Realness's backend: the store package's seams over the
 * serverless functions this app already owns, plus its offline queue and sync
 * index bookkeeping. */
import { get, set } from 'idb-keyval'
import { create_firebase_move } from '@realness.online/store/firebase'
import { mutex_for } from '@/utils/algorithms'
import { prepare_upload_html } from '@/utils/upload-processor'
import { is_sync_index_missing } from '@/utils/sync-file'
import { as_path_parts } from '@/utils/itemid'
import {
  current_user,
  directory,
  location,
  metadata,
  remove,
  upload,
  url
} from '@/utils/serverless'

/**
 * @param {string} itemid
 * @returns {boolean}
 */
export const is_admin_directory = itemid => {
  const raw = import.meta.env.VITE_ADMIN_ID
  if (!raw) return false
  const admin_id = `/${String(raw).replace(/^\/?/, '')}`
  const [author] = as_path_parts(itemid)
  return !!(author && `/${author}` === admin_id)
}

/**
 * @param {string} id
 * @param {'save' | 'delete'} action
 * @returns {Promise<void>}
 */
export const sync_later = async (id, action) => {
  const mutex = mutex_for('sync:offline')
  await mutex.lock()
  const offline = (await get('sync:offline')) || []
  const exists = offline.some(item => item.id === id && item.action === action)
  if (!exists) {
    offline.push({ id, action })
    await set('sync:offline', offline)
  }
  mutex.unlock()
}

/**
 * A saved item is no longer missing from the index.
 * @param {string} itemid
 * @returns {Promise<void>}
 */
export const after_upload = async itemid => {
  const index_mutex = mutex_for('sync:index')
  await index_mutex.lock()
  try {
    const index_raw = await get('sync:index')
    const index = index_raw && typeof index_raw === 'object' ? index_raw : {}
    if (itemid in index) {
      const next_index = { ...index }
      delete next_index[itemid]
      await set('sync:index', next_index)
    }
  } finally {
    index_mutex.unlock()
  }
}

/**
 * Items proven to exist clear their DOES_NOT_EXIST markers.
 * @param {string[]} itemids
 * @returns {Promise<void>}
 */
export const after_directory = async itemids => {
  const index = await get('sync:index')
  if (!index) return
  let index_changed = false
  itemids.forEach(id => {
    if (is_sync_index_missing(index[id])) {
      delete index[id]
      index_changed = true
    }
  })
  if (index_changed) await set('sync:index', index)
}

/**
 * storage.rules refuse to overwrite a poster the prints webhook tagged sold.
 * Keep the stored copy, sale and all; sync swaps it in for the local edit.
 * Throwing would strand the offline queue behind a lock it never releases.
 * @param {string} path
 * @param {string | Blob} body
 * @param {object} meta
 * @returns {Promise<object>} the upload, or the stored copy's metadata
 */
export const upload_unless_sold = async (path, body, meta) => {
  try {
    return await upload(path, body, meta)
  } catch (error) {
    if (error?.code !== 'storage/unauthorized') throw error
    const stored = await metadata(path).catch(() => null)
    if (stored?.customMetadata?.sold !== 'true') throw error
    console.warn(path, 'is sold; kept the stored copy')
    return stored
  }
}

export const backend = {
  upload: upload_unless_sold,
  remove: path => remove(path),
  // Deferred: a test that mocks `@/utils/serverless` may not define location.
  move: (from, to) =>
    create_firebase_move({ location: path => location(path) })(from, to),
  url: path => url(path),
  directory: path => directory(path),
  online: () => navigator.onLine,
  signed_in: () => !!current_user.value,
  can_read: itemid => !!current_user.value || is_admin_directory(itemid),
  serialize: items => prepare_upload_html(items),
  after_upload,
  after_directory,
  later: sync_later
}
