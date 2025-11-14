/** @typedef {import('@/types').Id} Id */
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
import { create_path_element } from '@/use/path'
import { to_kb } from '@/utils/numbers'
import { IMAGE } from '@/utils/numbers'
import { mutex } from '@/utils/algorithms'
import { as_query_id, as_fragment_id } from '@/utils/itemid'
import get_item from '@/utils/item'
import ExifReader from 'exifreader'
import { useRouter as use_router } from 'vue-router'
import * as Queue from '@/persistance/Queue'
import { Poster, Cutout } from '@/persistance/Storage'
import { size } from '@/utils/image'

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
const resize_to_blob = async file => {
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
  } else {
    try {
      bitmap = await createImageBitmap(file)
    } catch (error) {
      throw new Error(
        `File too large for browser to process (${file.name}): ${error.message}. Try resizing the image first or using a smaller file.`
      )
    }
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
const sort_cutouts_into_layers = (vector, id) => {
  const cutouts = {
    sediment: [],
    sand: [],
    gravel: [],
    rock: [],
    boulder: []
  }

  vector.cutout.forEach(cutout => {
    cutout.removeAttribute('itemprop')
    cutout.removeAttribute('tabindex')
    const progress = parseInt(cutout.getAttribute('data-progress') || 0)

    if (progress < 60) cutouts.sediment.push(cutout)
    else if (progress < 70) cutouts.sand.push(cutout)
    else if (progress < 80) cutouts.gravel.push(cutout)
    else if (progress < 90) cutouts.rock.push(cutout)
    else cutouts.boulder.push(cutout)
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

      symbol.setAttribute('id', `${as_query_id(id)}-${layer}`)
      symbol.setAttribute('itemid', `${id}-${layer}`)
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
 * @param {Element} poster_element - Poster SVG element
 * @param {Object} cutouts - Cutout symbols by layer
 */
const save_poster_and_symbols = async (id, poster_element, cutouts) => {
  await new Poster(id).save(poster_element)
  await new Cutout(`${id}-sediment`).save(cutouts.sediment)
  await new Cutout(`${id}-sand`).save(cutouts.sand)
  await new Cutout(`${id}-gravel`).save(cutouts.gravel)
  await new Cutout(`${id}-rock`).save(cutouts.rock)
  await new Cutout(`${id}-boulder`).save(cutouts.boulder)
}

export const use = () => {
  const router = use_router()
  const image_picker = inject('image-picker', ref(null))
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
  const make_path = path_data => {
    const path = create_path_element()
    path.setAttribute('d', path_data.d)
    path.style.fillRule = 'evenodd'
    return path
  }
  const make_cutout_path = path_data => {
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

  const clone_tracer_path = path_data => ({
    ...path_data,
    color: { ...path_data.color },
    offset: { ...path_data.offset }
  })
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

    const max_size = 200 * 1024 * 1024
    const too_large_files = []

    for (const file of files) {
      if (file.size > max_size) {
        too_large_files.push({
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(2)
        })
        continue
      }

      const id = /** @type {Id} */ (`${localStorage.me}/posters/${Date.now()}`)

      try {
        const { blob: resized_blob, width, height } = await resize_to_blob(file)

        const item = /** @type {QueueItem} */ ({
          id,
          resized_blob,
          status: 'pending',
          progress: 0,
          width,
          height
        })
        //eslint-disable-next-line no-await-in-loop
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

      await vectorize(next.resized_blob, next.id)
      mutex.unlock()
    } catch (error) {
      console.error('Error processing queue item:', error)
      if (current_processing.value) {
        await Queue.update(current_processing.value.id, { status: 'error' })
        const error_index = queue_items.value.findIndex(
          item => item.id === current_processing.value.id
        )
        if (error_index !== -1)
          queue_items.value[error_index] = {
            ...queue_items.value[error_index],
            status: 'error'
          }
        current_processing.value = null
      }
      is_processing.value = false
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
    if (index !== -1) {
      queue_items.value[index] = {
        ...queue_items.value[index],
        progress: progress_value
      }
    }
  }

  const init_processing_queue = async () => {
    await load_queue()
    for (const item of queue_items.value)
      if (item.status === 'processing') {
        await Queue.update(item.id, { status: 'pending' })
        item.status = 'pending'
      }

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
      await new Promise(resolve => (img.onload = resolve))
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
      const img = new Image()
      img.onload = async () => {
        const canvas = new OffscreenCanvas(
          img.width || 1000,
          img.height || 1000
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

    // Set correct dimensions from current processing item
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
    const optimized_data = get_item(message.data.vector)
    const element = document.getElementById(as_query_id(id))

    if (!element) {
      console.warn(`Could not find SVG element with id: ${as_query_id(id)}`)
      return
    }

    // Clear ALL old path references to prevent memory leak
    // The old paths become detached when replaced by optimized versions
    new_vector.value.light = null
    new_vector.value.regular = null
    new_vector.value.medium = null
    new_vector.value.bold = null
    if (new_vector.value.cutout) {
      new_vector.value.cutout.length = 0
      new_vector.value.cutout = null
    }

    new_vector.value.light = optimized_data.light
    new_vector.value.regular = optimized_data.regular
    new_vector.value.medium = optimized_data.medium
    new_vector.value.bold = optimized_data.bold
    new_vector.value.cutout = optimized_data.cutout
    new_vector.value.cutouts = {
      sediment: [],
      sand: [],
      gravel: [],
      rock: [],
      boulder: []
    }
    new_vector.value.optimized = true
    await tick()

    const cutouts = sort_cutouts_into_layers(new_vector.value, id)
    new_vector.value.cutout = undefined

    await save_poster_and_symbols(id, element, cutouts)

    completed_posters.value.push(id)

    const item_to_remove = queue_items.value.find(item => item.id === id)
    if (item_to_remove) cleanup_queue_item(item_to_remove)

    await Queue.remove(id)
    queue_items.value = queue_items.value.filter(item => item.id !== id)

    is_processing.value = false
    current_processing.value = null

    reset()

    process_queue()
  }

  const reset = () => {
    if (source_image_url.value) {
      URL.revokeObjectURL(source_image_url.value)
      source_image_url.value = null
    }
    if (new_vector.value) {
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
    init_processing_queue
  }
}
