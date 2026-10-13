/** Sentinel: no Storage object for this itemid (`sync:index` negative cache). */
/** @type {import('@/types').Sync_Index_Entry} */
export const DOES_NOT_EXIST = {
  updated: null,
  customMetadata: { hash: null }
}

/**
 * IndexedDB returns structured clones of `DOES_NOT_EXIST`, so `=== DOES_NOT_EXIST` never matches after persist.
 * @param {import('@/types').Sync_Index_Entry | undefined} entry
 * @returns {boolean}
 */
export const is_sync_index_missing = entry =>
  !!(
    entry &&
    typeof entry === 'object' &&
    entry.updated === null &&
    entry.customMetadata &&
    typeof entry.customMetadata === 'object' &&
    entry.customMetadata.hash === null
  )
