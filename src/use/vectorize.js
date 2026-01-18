/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Poster} PosterType */
/** @typedef {import('@/persistance/Queue').QueueItem} QueueItem */
/**
 * @typedef {Object} VectorResponse
 * @property {Object} data
 * @property {Object} data.vector
 */

import {
  ref,
  computed,
  onUnmounted as dismount,
  inject,
  nextTick as tick
} from 'vue'
import { useRouter as use_router } from 'vue-router'
import { create_path_element } from '@/use/path'
import { to_kb, IMAGE } from '@/utils/numbers'
import { mutex } from '@/utils/algorithms'
import { as_query_id, as_layer_id, as_created_at } from '@/utils/itemid'
import { as_directory_id } from '@/persistance/Directory'
import get_item from '@/utils/item'
import ExifReader from 'exifreader'

import * as Queue from '@/persistance/Queue'
import { Poster, Cutout, Shadow } from '@/persistance/Storage'

const new_vector = ref(null)
const new_gradients = ref(null)
const progress = ref(0)
const current_item_id = ref(null)
const source_image_url = ref(null)

// Queue state
const queue_items = ref(/** @type {QueueItem[]} */ ([]))
const current_processing = ref(/** @type {QueueItem | null} */ (null))
const is_processing = ref(false)
const completed_posters = ref(/** @type {Id[]} */ ([]))

/**
 * Create SVG path element with path data
 * @param {Object} path_data - Path data with 'd' attribute
 * @returns {SVGPathElement}
 */
export const make_path = path_data => {
  const path = create_path_element()
  path.setAttribute('d', path_data.d)
  path.style.fillRule = 'evenodd'
  return path
}

/**
 * Create cutout path element with color and transform
 * @param {Object} path_data - Path data with color, offset, and progress
 * @returns {SVGPathElement}
 */
export const make_cutout_path = path_data => {
  const path = create_path_element()
  path.setAttribute('d', path_data.d)
  path.setAttribute('fill-opacity', '0.5')
  path.setAttribute('data-progress', path_data.progress)
  path.dataset.transform = 'true'

  path.setAttribute(
    'fill',
    `rgb(${path_data.color.r}, ${path_data.color.g}, ${path_data.color.b})`
  )
  path.setAttribute(
    'transform',
    `translate(${path_data.offset.x}, ${path_data.offset.y})`
  )
  return path
}

/**
 * Deep clone tracer path data
 * @param {Object} path_data - Path data to clone
 * @returns {Object} Cloned path data
 */
export const clone_tracer_path = path_data => ({
  ...path_data,
  color: { ...path_data.color },
  offset: { ...path_data.offset }
})

/**
 * @param {ImageBitmap} image
 * @param {number} [target_size=IMAGE.TARGET_SIZE]
 * @returns {ImageData}
 */
export const resize_image = (image, target_size = IMAGE.TARGET_SIZE) => {
  let new_width = image.width
  let new_height = image.height

  if (image.width > image.height) {
    new_height = target_size
    new_width = Math.round((target_size * image.width) / image.height)
  } else {
    new_width = target_size
    new_height = Math.round((target_size * image.height) / image.width)
  }

  const canvas = new OffscreenCanvas(new_width, new_height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, new_width, new_height)
  return ctx.getImageData(0, 0, new_width, new_height)
}

/**
 * Resize image file to blob for storage
 * @param {File} file
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export const resize_to_blob = async file => {
  const needs_image_fallback =
    file.type === 'image/tiff' ||
    file.type === 'image/bmp' ||
    file.type === 'image/avif' ||
    file.name.toLowerCase().endsWith('.tif') ||
    file.name.toLowerCase().endsWith('.tiff') ||
    file.name.toLowerCase().endsWith('.bmp') ||
    file.name.toLowerCase().endsWith('.avif')

  let bitmap
  let url

  if (needs_image_fallback) {
    url = URL.createObjectURL(file)
    const img = new Image()

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error(`Failed to decode image: ${file.name}`))
      }
      img.src = url
    })

    try {
      bitmap = await createImageBitmap(img)
    } catch (error) {
      URL.revokeObjectURL(url)
      throw new Error(
        `Failed to process image (${file.name}): ${error.message}`
      )
    }
    URL.revokeObjectURL(url)
  } else
    try {
      bitmap = await createImageBitmap(file)
    } catch (error) {
      throw new Error(
        `File too large for browser to process (${file.name}): ${error.message}. Try resizing the image first or using a smaller file.`
      )
    }

  const image_data = resize_image(bitmap)
  bitmap.close()

  const canvas = new OffscreenCanvas(image_data.width, image_data.height)
  const ctx = canvas.getContext('2d')
  ctx.putImageData(image_data, 0, 0)

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 })
  return {
    blob,
    width: image_data.width,
    height: image_data.height
  }
}

/**
 * Load existing queue items
 */
const load_queue = async () => {
  queue_items.value = await Queue.get_all()
}

/**
 * Sort cutout elements into geology layers based on progress
 * @param {Object} vector - Vector object with cutout array
 * @param {Id} id - Poster itemid
 * @returns {Object} Cutouts organized by layer with symbol elements
 */
export const sort_cutouts_into_layers = (vector, id) => {
  const cutouts = {
    sediment: [],
    sand: [],
    gravel: [],
    rocks: [],
    boulders: []
  }

  vector.cutout.forEach(cutout => {
    cutout.removeAttribute('itemprop')
    cutout.removeAttribute('tabindex')
    const progress = parseInt(cutout.getAttribute('data-progress') || 0)

    if (progress < 60) cutouts.sediment.push(cutout)
    else if (progress < 70) cutouts.sand.push(cutout)
    else if (progress < 80) cutouts.gravel.push(cutout)
    else if (progress < 90) cutouts.rocks.push(cutout)
    else cutouts.boulders.push(cutout)
  })

  // Convert arrays to symbol elements
  Object.keys(cutouts).forEach(layer => {
    if (cutouts[layer].length > 0) {
      const symbol = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'symbol'
      )

      symbol.setAttribute('viewBox', `0 0 ${vector.width} ${vector.height}`)
      cutouts[layer].forEach(cutout => symbol.appendChild(cutout))

      const layer_id = as_layer_id(id, layer)
      symbol.setAttribute('id', as_query_id(layer_id))
      symbol.setAttribute('itemid', layer_id)
      symbol.setAttribute('itemscope', '')
      symbol.setAttribute('itemtype', '/cutouts')

      cutouts[layer] = symbol
    }
  })

  return cutouts
}

/**
 * Save poster and cutout symbols
 * @param {Id} id - Poster itemid
 * @param {Element} [element] - Optional DOM element to save
 * @param {Object.<string, SVGSymbolElement>} [cutouts] - Optional cutout symbols by layer
 */
export const save_poster = async (id, element = null, cutouts = null) => {
  await tick()
  const poster_element = element || document.querySelector(`[itemid="${id}"]`)

  if (!poster_element) {
    console.warn(`[save_poster] Could not find element for ${id}`)
    return
  }

  const geology_layers = ['sediment', 'sand', 'gravel', 'rocks', 'boulders']
  const shadow_id = as_layer_id(id, 'shadows')

  const find_layer_element = layer_id => {
    if (layer_id === shadow_id) {
      const shadow_element = poster_element.querySelector(
        `[itemid="${shadow_id}"]`
      )
      if (shadow_element) return shadow_element
      const global_shadow = document.querySelector(`[itemid="${shadow_id}"]`)
      if (global_shadow) return global_shadow
    }

    const [, , layer_name] = layer_id.split('/')

    if (cutouts && cutouts[layer_name]) {
      const symbol = cutouts[layer_name]
      if (symbol && symbol.outerHTML) return symbol
    }

    const layer_element = poster_element.querySelector(`[itemid="${layer_id}"]`)
    if (layer_element) return layer_element

    const global_element = document.querySelector(`[itemid="${layer_id}"]`)
    if (global_element) return global_element

    if (cutouts && cutouts[layer_name]) return cutouts[layer_name]

    return null
  }

  const created_at = as_created_at(id)
  if (created_at) {
    const path = as_directory_id(id)
    const { get, set } = await import('idb-keyval')
    const directory = await get(path)
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
  }

  const save_promises = []

  const shadow_el = find_layer_element(shadow_id)
  if (shadow_el) save_promises.push(new Shadow(shadow_id).save(shadow_el))
  else
    console.warn(`[save_poster] Could not find shadow element for ${shadow_id}`)

  geology_layers.forEach(layer => {
    const layer_id = as_layer_id(id, layer)
    const layer_el = find_layer_element(layer_id)
    if (layer_el) save_promises.push(new Cutout(layer_id).save(layer_el))
    else
      console.warn(
        `[save_poster] Could not find cutout element for ${layer_id}`
      )
  })

  await Promise.all(save_promises)
  await new Poster(id).save(poster_element)
}

// Composable manages entire vectorization pipeline: workers, queue, state, events
// Breaking into smaller pieces would scatter tightly coupled logic
// eslint-disable-next-line max-lines-per-function
export const use = () => {
  const router = use_router()
  const image_picker = inject('image-picker', ref(null))
  const set_working = inject('set_working')
  const working = ref(false)
  const vectorizer = ref(null)
  const gradienter = ref(null)
  const tracer = ref(null)
  const optimizer = ref(null)
  const is_mounted = ref(true)
  const workers_mounted = ref(false)
  const can_add = computed(() => {
    if (working.value || new_vector.value) return false
    return true
  })

  /**
   * Clean up blob references in queue item to release memory
   * @param {QueueItem} item
   */
  const cleanup_queue_item = item => {
    if (item?.resized_blob) item.resized_blob = null
  }

  const mount_workers = () => {
    if (workers_mounted.value) return

    // Clean up existing workers first
    if (vectorizer.value) {
      vectorizer.value.removeEventListener('message', vectorized)
      vectorizer.value.terminate()
    }
    if (gradienter.value) {
      gradienter.value.removeEventListener('message', gradientized)
      gradienter.value.terminate()
    }
    if (tracer.value) {
      tracer.value.removeEventListener('message', traced)
      tracer.value.terminate()
    }
    if (optimizer.value) {
      optimizer.value.removeEventListener('message', optimized)
      optimizer.value.terminate()
    }

    vectorizer.value = new Worker('/vector.worker.js')
    gradienter.value = new Worker('/vector.worker.js')
    tracer.value = new Worker('/tracer.worker.js')
    optimizer.value = new Worker('/vector.worker.js')
    vectorizer.value.addEventListener('message', vectorized)
    gradienter.value.addEventListener('message', gradientized)
    tracer.value.addEventListener('message', traced)
    optimizer.value.addEventListener('message', optimized)

    workers_mounted.value = true
  }

  const unmount_workers = () => {
    if (!workers_mounted.value) return

    if (vectorizer.value) {
      vectorizer.value.removeEventListener('message', vectorized)
      vectorizer.value.terminate()
      vectorizer.value = null
    }
    if (gradienter.value) {
      gradienter.value.removeEventListener('message', gradientized)
      gradienter.value.terminate()
      gradienter.value = null
    }
    if (tracer.value) {
      tracer.value.removeEventListener('message', traced)
      tracer.value.terminate()
      tracer.value = null
    }
    if (optimizer.value) {
      optimizer.value.removeEventListener('message', optimized)
      optimizer.value.terminate()
      optimizer.value = null
    }

    workers_mounted.value = false
  }

  const select_photo = () => {
    image_picker.value.removeAttribute('capture')
    image_picker.value.setAttribute('multiple', '')
    image_picker.value.click()
  }
  const open_selfie_camera = () => {
    image_picker.value.setAttribute('capture', 'user')
    image_picker.value.click()
  }
  const open_camera = () => {
    image_picker.value.setAttribute('capture', 'environment')
    image_picker.value.click()
  }

  /** @type {{ path: ReturnType<typeof clone_tracer_path>, progress: number }[]} */
  const pending_tracer_paths = []
  let tracer_complete_pending = false

  const clear_tracer_pending = () => {
    pending_tracer_paths.length = 0
    tracer_complete_pending = false
  }

  const add_cutout_path = (path_data, progress_value) => {
    if (!new_vector.value.cutout) new_vector.value.cutout = []
    const cutout_path = make_cutout_path({
      ...path_data,
      progress: progress_value
    })
    new_vector.value.cutout.push(cutout_path)
  }

  const flush_pending_tracer_paths = () => {
    if (!new_vector.value || pending_tracer_paths.length === 0) return
    const pending_paths = pending_tracer_paths.splice(
      0,
      pending_tracer_paths.length
    )
    pending_paths.forEach(({ path, progress }) =>
      add_cutout_path(path, progress)
    )
  }

  const handle_tracer_complete = async () => {
    if (new_vector.value && !new_vector.value.optimized)
      new_vector.value.completed = true

    if (current_item_id.value && new_gradients.value && new_vector.value) {
      await tick()
      const element = document.getElementById(
        as_query_id(current_item_id.value)
      )
      optimizer.value.postMessage({
        route: 'optimize:vector',
        vector: element.outerHTML
      })
    }
  }

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
        // eslint-disable-next-line no-await-in-loop
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
        // eslint-disable-next-line no-await-in-loop
        await Queue.add(item)
        queue_items.value.push(item)
      } catch (error) {
        console.error(
          `Failed to add ${file.name || 'file'} to queue:`,
          error.message
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
        if (set_working) set_working(false)
        current_processing.value = null
        unmount_workers()
        mutex.unlock()
        return
      }

      is_processing.value = true
      if (set_working) set_working(true)
      current_processing.value = next

      await Queue.update(next.id, { status: 'processing' })
      const index = queue_items.value.findIndex(item => item.id === next.id)
      if (index !== -1) queue_items.value[index].status = 'processing'

      await vectorize(next.resized_blob, next.id)
      mutex.unlock()
    } catch (error) {
      console.error('Error processing queue item:', error)
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
        // Cleanup after error handling completes
        // eslint-disable-next-line require-atomic-updates
        current_processing.value = null
      }
      is_processing.value = false
      if (set_working) set_working(false)
      reset()
      mutex.unlock()
      process_queue()
    }
  }

  /**
   * Update queue item progress
   * @param {Id} id
   * @param {number} progress_value
   */
  const update_progress = (id, progress_value) => {
    const index = queue_items.value.findIndex(item => item.id === id)
    if (index !== -1)
      queue_items.value[index] = {
        ...queue_items.value[index],
        progress: progress_value
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
        // False positive: updating local ref after DB write completes
        // eslint-disable-next-line require-atomic-updates
        item.status = 'pending'
      })
    )

    if (queue_items.value.length > 0) {
      mount_workers()
      process_queue()
    }
  }

  const listener = async () => {
    if (!image_picker.value?.files) return
    const files = Array.from(image_picker.value.files)
    if (files.length === 0) return

    const image_files = files.filter(file =>
      [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        'image/avif',
        'image/svg+xml'
      ].some(type => file.type === type)
    )

    if (image_files.length > 0) {
      await add_to_queue(image_files)
      router.push('/posters')
      if (image_picker.value) image_picker.value.value = ''
    }
  }

  const vVectorizer = {
    /**
     * @param {Object} input
     */
    mounted: input => {
      input.addEventListener('change', listener)
    }
  }

  /**
   * @param {File|Blob} image
   * @param {string} [itemid]
   */
  const vectorize = async (image, itemid = null) => {
    if (!vectorizer.value) mount_workers()

    working.value = true
    progress.value = 0
    current_item_id.value = itemid
    clear_tracer_pending()

    let image_data
    let exif = {}

    const is_pre_resized = image instanceof Blob && !(image instanceof File)

    if (source_image_url.value) URL.revokeObjectURL(source_image_url.value)
    source_image_url.value = URL.createObjectURL(image)

    if (image.type === 'image/svg+xml') image_data = await rasterize_svg(image)
    else {
      const image_url = URL.createObjectURL(image)
      const img = new Image()
      img.src = image_url
      await new Promise(resolve => {
        img.onload = resolve
      })
      const bitmap = await createImageBitmap(img)

      if (is_pre_resized) {
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(bitmap, 0, 0)
        image_data = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      } else image_data = resize_image(bitmap)

      bitmap.close()
      URL.revokeObjectURL(image_url)

      if (!is_pre_resized)
        try {
          const tags = await ExifReader.load(image, { expanded: true })
          exif = exif_logger(tags)
        } catch (error) {
          console.warn('Failed to parse EXIF data:', error.message)
          exif = {}
        }
    }

    vectorizer.value.postMessage({
      route: 'make:vector',
      image_data,
      exif
    })
    gradienter.value.postMessage({
      route: 'make:gradient',
      image_data
    })
    tracer.value.postMessage({
      route: 'make:trace',
      image_data
    })
  }

  /**
   * @param {File|Blob} svg_file
   * @returns {Promise<ImageData>}
   */
  const rasterize_svg = async svg_file => {
    const svg_text = await svg_file.text()
    const svg_blob = new Blob([svg_text], { type: 'image/svg+xml' })
    const svg_url = URL.createObjectURL(svg_blob)

    return new Promise((resolve, reject) => {
      const DEFAULT_CANVAS_DIMENSION = 1000
      const img = new Image()
      img.onload = async () => {
        const canvas = new OffscreenCanvas(
          img.width || DEFAULT_CANVAS_DIMENSION,
          img.height || DEFAULT_CANVAS_DIMENSION
        )
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(svg_url)
        const bitmap = await createImageBitmap(canvas)
        const resized_image_data = resize_image(bitmap)
        bitmap.close()
        resolve(resized_image_data)
      }
      img.onerror = () => {
        URL.revokeObjectURL(svg_url)
        reject(new Error('Failed to load SVG'))
      }
      img.src = svg_url
    })
  }

  /**
   * @param {Object} tags
   * @returns {Object}
   */
  const exif_logger = tags => {
    const cloned = structuredClone(tags)
    console.info('EXIF: ', `${to_kb(cloned)}kb`, cloned)
    return cloned
  }

  /**
   * @param {VectorResponse} response
   */
  const vectorized = async response => {
    if (!is_mounted.value) return
    const { vector } = response.data

    vector.id = current_item_id.value
    vector.type = 'posters'
    vector.light = make_path(vector.light)
    vector.regular = make_path(vector.regular)
    vector.medium = make_path(vector.medium)
    vector.bold = make_path(vector.bold)

    if (current_processing.value) {
      vector.width = current_processing.value.width
      vector.height = current_processing.value.height
      vector.viewbox = `0 0 ${vector.width} ${vector.height}`
    }

    new_vector.value = vector

    flush_pending_tracer_paths()
    if (tracer_complete_pending) {
      tracer_complete_pending = false
      await handle_tracer_complete()
    }
    await tick()
  }

  const gradientized = message => {
    if (!is_mounted.value) return
    new_gradients.value = message.data.gradients
  }

  /**
   * Handles messages from the tracer worker
   * @param {Object} message - Message from tracer worker
   * @description
   * The tracer worker sends cutout data as objects with d, color, and offset properties.
   * When tracing completes, we convert these objects to SVG path elements to maintain
   * consistency with the main paths (light, regular, medium, bold) and enable SVGO optimization.
   */
  const traced = async message => {
    if (!is_mounted.value) return
    switch (message.data.type) {
      case 'progress':
        progress.value = message.data.progress
        if (current_item_id.value)
          update_progress(current_item_id.value, message.data.progress)
        break
      case 'path':
        if (message.data.progress !== undefined) {
          progress.value = message.data.progress
          if (current_item_id.value)
            update_progress(current_item_id.value, message.data.progress)
        }
        if (!new_vector.value) {
          pending_tracer_paths.push({
            path: clone_tracer_path(message.data.path),
            progress: message.data.progress
          })
          break
        }
        add_cutout_path(message.data.path, message.data.progress)
        break
      case 'complete':
        if (!new_vector.value) {
          tracer_complete_pending = true
          break
        }
        await handle_tracer_complete()
        break
      case 'error':
        console.error('Tracer error:', message.error)
        break
    }
  }

  const optimized = async message => {
    if (!is_mounted.value) return
    const id = /** @type {Id} */ (current_item_id.value)
    const optimized_data = get_item(message.data.vector, id)

    clear_vector_paths()

    const poster = /** @type {PosterType} */ (new_vector.value)
    const optimized_poster = /** @type {PosterType} */ (
      /** @type {unknown} */ (optimized_data)
    )
    poster.light = optimized_poster.light
    poster.regular = optimized_poster.regular
    poster.medium = optimized_poster.medium
    poster.bold = optimized_poster.bold
    poster.cutout = optimized_poster.cutout
    poster.optimized = true
    await tick()
    const cutouts = sort_cutouts_into_layers(poster, id)
    poster.cutout = undefined
    poster.cutouts = cutouts

    const element = document.querySelector(`svg[itemid="${id}"]`)
    await save_poster(id, element, cutouts)

    completed_posters.value.push(id)

    const item_to_remove = queue_items.value.find(item => item.id === id)
    if (item_to_remove) cleanup_queue_item(item_to_remove)

    await Queue.remove(id)
    queue_items.value = queue_items.value.filter(item => item.id !== id)

    is_processing.value = false
    if (set_working) set_working(false)
    current_processing.value = null

    reset()

    process_queue()
  }

  /**
   * Clear vector path references to prevent memory leaks
   * The old paths become detached when replaced by optimized versions
   */
  const clear_vector_paths = () => {
    if (!new_vector.value) return
    new_vector.value.light = null
    new_vector.value.regular = null
    new_vector.value.medium = null
    new_vector.value.bold = null
    if (new_vector.value.cutout) {
      new_vector.value.cutout.length = 0
      new_vector.value.cutout = null
    }
    if (new_vector.value.cutouts) {
      Object.keys(new_vector.value.cutouts).forEach(key => {
        new_vector.value.cutouts[key] = null
      })
      new_vector.value.cutouts = null
    }
  }

  /**
   * Clean up memory references to prevent leaks
   * Revokes object URLs and nullifies vector path references
   */
  const cleanup_memory_references = () => {
    if (source_image_url.value) {
      URL.revokeObjectURL(source_image_url.value)
      source_image_url.value = null
    }
    clear_vector_paths()
  }

  const reset = () => {
    cleanup_memory_references()
    clear_tracer_pending()
    new_vector.value = null
    new_gradients.value = null
    progress.value = 0
    current_item_id.value = null
  }

  dismount(() => {
    is_mounted.value = false
    unmount_workers()
  })
  return {
    can_add,
    select_photo,
    open_selfie_camera,
    open_camera,
    image_picker,
    vVectorizer,
    vectorize,
    vectorizer,
    gradienter,
    tracer,
    working,
    new_vector,
    new_gradients,
    source_image_url,
    mount_workers,
    progress,
    reset,
    queue_items: computed(() => queue_items.value),
    current_processing: computed(() => current_processing.value),
    is_processing: computed(() => is_processing.value),
    completed_posters: computed(() => completed_posters.value),
    add_to_queue,
    init_processing_queue,
    cleanup_queue_item
  }
}
