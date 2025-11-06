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
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  await new Promise(resolve => (img.onload = resolve))

  const bitmap = await createImageBitmap(img)
  const image_data = resize_image(bitmap)

  const canvas = new OffscreenCanvas(image_data.width, image_data.height)
  const ctx = canvas.getContext('2d')
  ctx.putImageData(image_data, 0, 0)
  URL.revokeObjectURL(url)

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
  const can_add = computed(() => {
    if (working.value || new_vector.value) return false
    return true
  })

  const mount_workers = () => {
    // Clean up existing workers first
    if (vectorizer.value) vectorizer.value.terminate()
    if (gradienter.value) gradienter.value.terminate()
    if (tracer.value) tracer.value.terminate()
    if (optimizer.value) optimizer.value.terminate()

    vectorizer.value = new Worker('/vector.worker.js')
    gradienter.value = new Worker('/vector.worker.js')
    tracer.value = new Worker('/tracer.worker.js')
    optimizer.value = new Worker('/vector.worker.js')
    vectorizer.value.addEventListener('message', vectorized)
    gradienter.value.addEventListener('message', gradientized)
    tracer.value.addEventListener('message', traced)
    optimizer.value.addEventListener('message', optimized)
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

  /**
   * Add files to processing queue
   * @param {File[]} files
   * @returns {Promise<void>}
   */
  const add_to_queue = async files => {
    for (const file of files) {
      const id = /** @type {Id} */ (`${localStorage.me}/posters/${Date.now()}`)
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
    }

    process_queue()
  }

  const process_queue = async () => {
    await mutex.lock()

    try {
      const next = await Queue.get_next()
      console.log('Next item:', next?.id || 'none')
      if (!next) {
        is_processing.value = false
        current_processing.value = null
        return
      }

      is_processing.value = true
      current_processing.value = next

      await Queue.update(next.id, { status: 'processing' })
      const index = queue_items.value.findIndex(item => item.id === next.id)
      if (index !== -1) queue_items.value[index].status = 'processing'

      await vectorize(next.resized_blob, next.id)
    } finally {
      mutex.unlock()
    }
  }

  /**
   * Update queue item progress
   * @param {Id} id
   * @param {number} progress_value
   */
  const update_progress = async (id, progress_value) => {
    await Queue.update(id, { progress: progress_value })

    const index = queue_items.value.findIndex(item => item.id === id)
    if (index !== -1) queue_items.value[index].progress = progress_value
  }

  const init_processing_queue = async () => {
    await load_queue()
    for (const item of queue_items.value)
      if (item.status === 'processing') {
        await Queue.update(item.id, { status: 'pending' })
        item.status = 'pending'
      }

    if (queue_items.value.length > 0) process_queue()
  }

  const listener = async () => {
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
      image_picker.value.value = ''
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
    working.value = true
    progress.value = 0
    current_item_id.value = itemid

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
        const image_data = ctx.getImageData(0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(svg_url)
        resolve(resize_image(await createImageBitmap(canvas)))
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
  const vectorized = response => {
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

    if (current_item_id.value) update_progress(current_item_id.value, 50)
  }

  const gradientized = message => {
    new_gradients.value = message.data.gradients
    if (current_item_id.value) update_progress(current_item_id.value, 60)
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
    switch (message.data.type) {
      case 'progress':
        progress.value = message.data.progress
        if (current_item_id.value)
          update_progress(current_item_id.value, message.data.progress)
        break
      case 'path':
        if (!new_vector.value) return
        if (!new_vector.value.cutout) new_vector.value.cutout = []
        const cutout_path = make_cutout_path({
          ...message.data.path,
          progress: message.data.progress
        })
        new_vector.value.cutout.push(cutout_path)
        break
      case 'complete':
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

        break
      case 'error':
        console.error('Tracer error:', message.error)
        break
    }
  }

  const optimized = async message => {
    const id = /** @type {Id} */ (current_item_id.value)
    const optimized_data = get_item(message.data.vector)
    const element = document.getElementById(as_query_id(id))

    if (!element) {
      console.warn(`Could not find SVG element with id: ${as_query_id(id)}`)
      return
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
    optimizer.value.removeEventListener('message', optimized)
    await tick()

    const cutouts = sort_cutouts_into_layers(new_vector.value, id)
    new_vector.value.cutout = undefined

    console.log('sorted poster', new_vector.value)
    await save_poster_and_symbols(id, element, cutouts)

    completed_posters.value.push(id)

    await Queue.remove(id)
    queue_items.value = queue_items.value.filter(item => item.id !== id)

    is_processing.value = false
    current_processing.value = null

    reset()

    process_queue()
  }

  // Initialize workers immediately
  mount_workers()

  const reset = () => {
    if (source_image_url.value) {
      URL.revokeObjectURL(source_image_url.value)
      source_image_url.value = null
    }
    new_vector.value = null
    new_gradients.value = null
    progress.value = 0
    current_item_id.value = null
  }

  dismount(() => {
    if (vectorizer.value) vectorizer.value.terminate()
    if (gradienter.value) gradienter.value.terminate()
    if (tracer.value) tracer.value.terminate()
    if (optimizer.value) optimizer.value.terminate()
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
