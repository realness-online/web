import { ref } from 'vue'
import * as Queue from '@/persistence/Queue'
import { mutex_for } from '@/utils/algorithms'

/** @typedef {import('@/persistence/Queue').QueueItem} QueueItem */
/** @typedef {import('@/types').Id} Id */

/** Shared queue state for the vectorization pipeline */
export const queue_items = ref(/** @type {QueueItem[]} */ ([]))
export const current_processing = ref(/** @type {QueueItem | null} */ (null))
export const is_processing = ref(false)
export const completed_posters = ref(/** @type {Id[]} */ ([]))

/**
 * Update queue item progress
 * @param {Id} id
 * @param {number} progress_value
 */
export const update_progress = (id, progress_value) => {
  const index = queue_items.value.findIndex(item => item.id === id)
  if (index !== -1)
    queue_items.value[index] = {
      ...queue_items.value[index],
      progress: progress_value
    }
}

/**
 * Load existing queue items from storage
 */
const load_queue = async () => {
  queue_items.value = await Queue.get_all()
}

/**
 * Create queue processing composable.
 *
 * @param {Object} deps
 * @param {Function} deps.mount_workers
 * @param {Function} deps.unmount_workers
 * @param {Function} deps.vectorize
 * @param {Function} deps.reset
 * @param {Function} deps.resize_to_blob
 */
export const use_queue = deps => {
  const { mount_workers, unmount_workers, vectorize, reset, resize_to_blob } =
    deps

  const mutex = mutex_for('vectorize')

  /**
   * Add files to processing queue
   * @param {File[]} files
   * @returns {Promise<void>}
   */
  const add_to_queue = async files => {
    mount_workers()

    const MAX_FILE_SIZE_MB = 200
    const BYTES_PER_KB = 1024
    const KB_PER_MB = 1024
    const max_size = MAX_FILE_SIZE_MB * BYTES_PER_KB * KB_PER_MB
    const too_large_files = []

    for (const file of files) {
      if (file.size > max_size) {
        too_large_files.push({
          name: file.name,
          size: (file.size / BYTES_PER_KB / KB_PER_MB).toFixed(2)
        })
        continue
      }

      const id = /** @type {Id} */ (`${localStorage.me}/posters/${Date.now()}`)

      try {
        // Sequential processing required: timestamp-based IDs need unique millisecond values
        // oxlint-disable-next-line no-await-in-loop
        const { blob: resized_blob, width, height } = await resize_to_blob(file)

        const item = /** @type {QueueItem} */ ({
          id,
          itemid: id,
          resized_blob,
          status: 'pending',
          progress: 0,
          width,
          height
        })
        // Sequential processing required: timestamp-based IDs need unique millisecond values
        // oxlint-disable-next-line no-await-in-loop
        await Queue.add(item)
        queue_items.value.push(item)
      } catch (error) {
        console.error(
          `Failed to add ${file.name || 'file'} to queue:`,
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    if (too_large_files.length > 0) {
      const file_list = too_large_files
        .map(f => `  - ${f.name} (${f.size}MB)`)
        .join('\n')
      console.error(
        `Files skipped (exceed 200MB browser limit):\n${file_list}\n\nPlease resize these images before uploading.`
      )
    }

    process_queue()
  }

  const process_queue = async () => {
    await mutex.lock()

    try {
      const next = await Queue.get_next()
      if (!next) {
        is_processing.value = false
        current_processing.value = null
        unmount_workers()
        mutex.unlock()
        return
      }

      is_processing.value = true
      current_processing.value = next

      await Queue.update(next.id, { status: 'processing' })
      const index = queue_items.value.findIndex(item => item.id === next.id)
      if (index !== -1) queue_items.value[index].status = 'processing'

      const image_blob =
        next.resized_blob instanceof ArrayBuffer
          ? new Blob([next.resized_blob], { type: 'image/jpeg' })
          : next.resized_blob
      if (!image_blob) {
        await Queue.update(next.id, { status: 'error' })
        const error_index = queue_items.value.findIndex(
          item => item.id === next.id
        )
        if (error_index !== -1)
          queue_items.value[error_index] = {
            ...queue_items.value[error_index],
            status: 'error'
          }
        current_processing.value = null
        is_processing.value = false
        mutex.unlock()
        process_queue()
        return
      }
      await vectorize(image_blob, next.id)
      mutex.unlock()
    } catch (error) {
      console.error(
        'Error processing queue item:',
        error instanceof Error ? error.message : String(error)
      )
      const failed_item = current_processing.value
      if (failed_item) {
        await Queue.update(failed_item.id, { status: 'error' })
        const error_index = queue_items.value.findIndex(
          item => item.id === failed_item.id
        )
        if (error_index !== -1)
          queue_items.value[error_index] = {
            ...queue_items.value[error_index],
            status: 'error'
          }
        // eslint-disable-next-line require-atomic-updates
        current_processing.value = null
      }
      is_processing.value = false
      reset()
      mutex.unlock()
      process_queue()
    }
  }

  const init_processing_queue = async () => {
    await load_queue()

    const stuck_items = queue_items.value.filter(
      item => item.status === 'processing'
    )

    await Promise.all(
      stuck_items.map(async item => {
        await Queue.update(item.id, { status: 'pending' })
        // eslint-disable-next-line require-atomic-updates
        item.status = 'pending'
      })
    )

    if (queue_items.value.length > 0) {
      mount_workers()
      process_queue()
    }
  }

  return {
    add_to_queue,
    process_queue,
    init_processing_queue,
    update_progress
  }
}
