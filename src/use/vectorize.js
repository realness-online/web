/**
 * @typedef {import('@/types').Id} Id
 * @typedef {import('@/types').Poster} PosterType
 * @typedef {import('@/types').Cutout_Layers} Cutout_Layers
 * @typedef {import('@/persistence/Queue').QueueItem} QueueItem
 * @typedef {Object} VectorResponse
 * @property {Object} data
 * @property {Object} [data.vector]
 * @property {string} [data.error]
 */

import {
  ref,
  computed,
  onUnmounted as dismount,
  inject,
  getCurrentInstance as current_instance,
  nextTick as tick
} from 'vue'
import { create_path_element } from '@/use/path'
import { IMAGE } from '@/utils/numbers'
import { as_query_id, as_layer_id, as_created_at } from '@/utils/itemid'
import { as_directory_id } from '@/persistence/Directory'
import get_item from '@/utils/item'

import * as Queue from '@/persistence/Queue'
import { Poster, Cutout, Shadow } from '@/persistence/Storage'
import { get, set } from 'idb-keyval'

import { use_workers } from './vectorize/workers'
import {
  use_queue,
  queue_items,
  current_processing,
  is_processing,
  completed_posters,
  update_progress
} from './vectorize/queue'
import { use_file_input } from './vectorize/file-input'

// ---- Module-level reactive state ----

const new_vector = ref(/** @type {PosterType | null} */ (null))
const new_gradients = ref(
  /** @type {{horizontal?: string[], vertical?: string[], radial?: string[]} | null} */ (
    null
  )
)
const progress = ref(0)
const current_item_id = ref(/** @type {Id | null} */ (null))
const source_image_url = ref(/** @type {string | null} */ (null))

// ---- Module-level helpers ----

/**
 * Create SVG path element with path data
 * @param {Object} path_data
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
 * @param {Object} path_data - data with color, offset, and progress
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
 * @param {Object} path_data
 * @returns {Object}
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
  if (!ctx) throw new Error('Failed to get 2d context')
  ctx.drawImage(image, 0, 0, new_width, new_height)
  return ctx.getImageData(0, 0, new_width, new_height)
}

/**
 * Resize image file to blob for storage
 * @param {File} file
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export const resize_to_blob = async file => {
  // SVG reuses the same rasterize path as the vectorize step (handles
  // viewBox-only files via the default dimension fallback).
  if (
    file.type === 'image/svg+xml' ||
    file.name.toLowerCase().endsWith('.svg')
  ) {
    const image_data = await rasterize_svg(file)
    const canvas = new OffscreenCanvas(image_data.width, image_data.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2d context')
    ctx.putImageData(image_data, 0, 0)
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.7
    })
    return {
      blob,
      width: image_data.width,
      height: image_data.height
    }
  }

  const lower_name = file.name.toLowerCase()
  const needs_fallback =
    file.type === 'image/tiff' ||
    file.type === 'image/bmp' ||
    file.type === 'image/avif' ||
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    lower_name.endsWith('.tif') ||
    lower_name.endsWith('.tiff') ||
    lower_name.endsWith('.bmp') ||
    lower_name.endsWith('.avif') ||
    lower_name.endsWith('.heic') ||
    lower_name.endsWith('.heif')

  let bitmap
  let url

  if (needs_fallback) {
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
        `Failed to process image (${file.name}): ${error instanceof Error ? error.message : String(error)}`
      )
    }
    URL.revokeObjectURL(url)
  } else
    try {
      bitmap = await createImageBitmap(file)
    } catch (error) {
      throw new Error(
        `File too large for browser to process (${file.name}): ${error instanceof Error ? error.message : String(error)}. Try resizing the image first or using a smaller file.`
      )
    }

  const image_data = resize_image(bitmap)
  bitmap.close()

  const canvas = new OffscreenCanvas(image_data.width, image_data.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2d context')
  ctx.putImageData(image_data, 0, 0)

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 })
  return { blob, width: image_data.width, height: image_data.height }
}

/**
 * Sort cutout elements into geology layers based on progress
 * @param {Object} vector
 * @param {Id} id
 * @returns {Cutout_Layers} Cutouts organized by geology layer
 */
export const sort_cutouts_into_layers = (vector, id) => {
  /** @type {{sediment: Element[], sand: Element[], gravel: Element[], rocks: Element[], boulders: Element[]}} */
  const cutouts = {
    sediment: [],
    sand: [],
    gravel: [],
    rocks: [],
    boulders: []
  }

  let cutout_list
  if (Array.isArray(vector.cutout)) cutout_list = vector.cutout
  else if (vector.cutout !== null && vector.cutout !== undefined)
    cutout_list = [vector.cutout]
  else cutout_list = []
  cutout_list.forEach(cutout => {
    if (!(cutout instanceof Element)) return
    cutout.removeAttribute('itemprop')
    cutout.removeAttribute('tabindex')
    const progress_val = parseInt(cutout.getAttribute('data-progress') || '0')

    if (progress_val < 60) cutouts.sediment.push(cutout)
    else if (progress_val < 70) cutouts.sand.push(cutout)
    else if (progress_val < 80) cutouts.gravel.push(cutout)
    else if (progress_val < 90) cutouts.rocks.push(cutout)
    else cutouts.boulders.push(cutout)
  })

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
    } else delete cutouts[layer]
  })

  return /** @type {Cutout_Layers} */ (/** @type {unknown} */ (cutouts))
}

/**
 * Save poster and cutout symbols
 * @param {Id} id
 * @param {Element} [element]
 * @param {Cutout_Layers} [cutouts]
 */
export const save_poster = async (
  id,
  element = undefined,
  cutouts = undefined
) => {
  await tick()
  const poster_element = element ?? document.querySelector(`[itemid="${id}"]`)

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
    const dir_path = as_directory_id(id)
    const directory = await get(dir_path)
    if (directory && directory.items) {
      if (!directory.items.includes(created_at)) {
        directory.items.push(created_at)
        await set(dir_path, directory)
      }
    } else {
      const new_directory = {
        id: dir_path,
        types: [],
        archive: [],
        items: [created_at]
      }
      await set(dir_path, new_directory)
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

  const directory_path = as_directory_id(id)
  await new Poster(/** @type {Id} */ (directory_path)).optimize()
}

/**
 * Clear vector path references to prevent memory leaks
 */
const clear_vector_paths = () => {
  const vec = new_vector.value
  if (!vec) return
  vec.light = /** @type {import('@/types').Path} */ (
    /** @type {unknown} */ (undefined)
  )
  vec.regular = /** @type {import('@/types').Path} */ (
    /** @type {unknown} */ (undefined)
  )
  vec.medium = /** @type {import('@/types').Path} */ (
    /** @type {unknown} */ (undefined)
  )
  vec.bold = /** @type {import('@/types').Path} */ (
    /** @type {unknown} */ (undefined)
  )
  vec.cutout = undefined
  vec.cutouts = undefined
}

/** Clean up memory references to prevent leaks */
const cleanup_memory_references = () => {
  if (source_image_url.value) {
    URL.revokeObjectURL(source_image_url.value)
    source_image_url.value = null
  }
  clear_vector_paths()
}

/**
 * Clean up blob references in queue item to release memory
 * @param {QueueItem} item
 */
const cleanup_queue_item = item => {
  if (item?.resized_blob)
    /** @type {Blob | ArrayBuffer | null} */
    item.resized_blob = null
}

/**
 * Rasterize SVG file to ImageData
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
      if (!ctx) throw new Error('Failed to get 2d context')
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

// ---- Tracer buffering ----

/**
 * Buffers tracer paths and completion that arrive before `new_vector` is set,
 * then applies them once the vector is ready. Owns all pending tracer state.
 *
 * @param {ReturnType<typeof use_workers>} workers
 */
const create_tracer_buffer = workers => {
  /** @type {{ path: ReturnType<typeof clone_tracer_path>, progress: number }[]} */
  const pending_paths = []
  let complete_pending = false

  const clear = () => {
    pending_paths.length = 0
    complete_pending = false
  }

  const add_cutout_path = (path_data, progress_value) => {
    const vec = new_vector.value
    if (!vec) return
    const existing = vec.cutout
    let cutout_list
    if (Array.isArray(existing)) cutout_list = existing
    else if (existing) cutout_list = [existing]
    else cutout_list = []
    const cutout_path = make_cutout_path({
      ...path_data,
      progress: progress_value
    })
    cutout_list.push(cutout_path)
    vec.cutout = [...cutout_list]
  }

  const buffer_path = (path_data, progress_value) => {
    pending_paths.push({
      path: clone_tracer_path(path_data),
      progress: progress_value
    })
  }

  const mark_complete_pending = () => {
    complete_pending = true
  }

  const handle_complete = async () => {
    const vec = new_vector.value
    if (vec && !vec.optimized) vec.completed = true

    const cid = current_item_id.value
    const opt = workers.optimizer.value
    if (!cid || !new_gradients.value || !vec || !opt) return
    await tick()
    const element = document.getElementById(as_query_id(cid))
    if (!element) return
    opt.postMessage({ route: 'optimize:vector', vector: element.outerHTML })
  }

  /** Apply anything buffered while waiting for `new_vector`. */
  const on_vector_ready = async () => {
    if (pending_paths.length > 0) {
      const drained = pending_paths.splice(0, pending_paths.length)
      drained.forEach(({ path, progress }) => add_cutout_path(path, progress))
    }
    if (complete_pending) {
      complete_pending = false
      await handle_complete()
    }
  }

  return {
    clear,
    add_cutout_path,
    buffer_path,
    mark_complete_pending,
    handle_complete,
    on_vector_ready
  }
}

// ---- Pipeline (image in, workers dispatched) ----

/**
 * Rasterizes/resizes an incoming image and dispatches it to the workers.
 *
 * @param {ReturnType<typeof use_workers>} workers
 * @param {import('vue').Ref<boolean>} working
 * @param {ReturnType<typeof create_tracer_buffer>} tracer
 */
const create_pipeline = (workers, working, tracer) => {
  /**
   * @param {File|Blob} image
   * @param {Id | null} [itemid]
   */
  const vectorize = async (image, itemid) => {
    if (!workers.vectorizer.value) workers.mount_workers()

    working.value = true
    progress.value = 0
    current_item_id.value = itemid ?? null
    tracer.clear()

    let image_data
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
        if (!ctx) throw new Error('Failed to get 2d context')
        ctx.drawImage(bitmap, 0, 0)
        image_data = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
      } else image_data = resize_image(bitmap)

      bitmap.close()
      URL.revokeObjectURL(image_url)
    }

    const v = workers.vectorizer.value
    const g = workers.gradienter.value
    const t = workers.tracer.value
    if (!v || !g || !t) {
      working.value = false
      return
    }
    v.postMessage({ route: 'make:vector', image_data })
    g.postMessage({ route: 'make:gradient', image_data })
    t.postMessage({ route: 'make:trace', image_data })
  }

  const reset = () => {
    cleanup_memory_references()
    tracer.clear()
    new_vector.value = null
    new_gradients.value = null
    progress.value = 0
    current_item_id.value = null
  }

  return { vectorize, reset }
}

// ---- Worker message handlers ----

/**
 * Builds the four worker `message` callbacks, wired to the tracer buffer,
 * the pipeline `reset`, and a `run_queue` continuation.
 *
 * @param {Object} deps
 * @param {import('vue').Ref<boolean>} deps.is_mounted
 * @param {ReturnType<typeof create_tracer_buffer>} deps.tracer
 * @param {() => void} deps.reset
 * @param {() => Promise<void>} deps.run_queue
 */
const create_worker_handlers = ({ is_mounted, tracer, reset, run_queue }) => {
  /**
   * Marks the in-flight queue item as errored and continues the queue,
   * instead of leaving the whole pipeline stalled on one worker failure.
   * @param {Id} id
   * @param {unknown} error
   */
  const fail_current_item = async (id, error) => {
    console.error('[vectorize] Worker error, skipping item:', error)
    await Queue.update(id, { status: 'error' })
    const item_to_remove = queue_items.value.find(item => item.id === id)
    if (item_to_remove) cleanup_queue_item(item_to_remove)
    queue_items.value = queue_items.value.filter(item => item.id !== id)
    is_processing.value = false
    current_processing.value = null
    reset()
    await run_queue()
  }

  /**
   * @param {VectorResponse} response
   */
  const vectorized = async response => {
    if (!is_mounted.value) return
    const cid = current_item_id.value
    if (!cid) return

    if (response.data?.error) {
      await fail_current_item(cid, response.data.error)
      return
    }

    const { vector } = response.data
    vector.id = cid
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

    await tracer.on_vector_ready()
    await tick()
  }

  const gradientized = message => {
    if (!is_mounted.value) return
    if (message.data?.error) {
      console.error('[vectorize] Gradient worker error:', message.data.error)
      return
    }
    new_gradients.value = message.data.gradients
  }

  /**
   * @param {Object} message
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
          tracer.buffer_path(message.data.path, message.data.progress)
          break
        }
        tracer.add_cutout_path(message.data.path, message.data.progress)
        break
      case 'complete':
        if (!new_vector.value) {
          tracer.mark_complete_pending()
          break
        }
        await tracer.handle_complete()
        break
      case 'error':
        const err = message.data?.error ?? message.error
        console.error(
          'Tracer error:',
          err instanceof Error ? err.message : String(err)
        )
        break
    }
  }

  const optimized = async message => {
    if (!is_mounted.value) return
    const id = current_item_id.value
    const vec = new_vector.value
    if (!id || !vec) return

    if (message.data?.error) {
      await fail_current_item(id, message.data.error)
      return
    }

    const optimized_data = get_item(message.data.vector, id)

    clear_vector_paths()

    const poster = vec
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
    await save_poster(id, element ?? undefined, cutouts)

    completed_posters.value.push(id)

    const item_to_remove = queue_items.value.find(item => item.id === id)
    if (item_to_remove) cleanup_queue_item(item_to_remove)

    await Queue.remove(id)
    queue_items.value = queue_items.value.filter(item => item.id !== id)

    is_processing.value = false
    current_processing.value = null

    reset()
    await run_queue()
  }

  return { vectorized, gradientized, traced, optimized }
}

// ---- Composable ----

/**
 * Main vectorization pipeline composable.
 * Orchestrates workers, queue, file input, and poster processing.
 *
 * @param {import('vue').Ref<HTMLInputElement | null>} [provided_image_picker]
 */
export const use = provided_image_picker => {
  const instance = current_instance()
  const image_picker =
    provided_image_picker ??
    (instance
      ? inject(
          'image-picker',
          ref(/** @type {HTMLInputElement | null} */ (null))
        )
      : ref(/** @type {HTMLInputElement | null} */ (null)))
  const working = ref(false)
  const is_mounted = ref(true)

  const workers = use_workers()
  const tracer = create_tracer_buffer(workers)
  const { vectorize, reset } = create_pipeline(workers, working, tracer)

  // Forward ref: the queue is created below, after the handlers it feeds.
  let run_queue = async () => {}

  const unmount = () => {
    is_mounted.value = false
    workers.unmount_workers()
  }

  workers.set_handlers(
    create_worker_handlers({
      is_mounted,
      tracer,
      reset,
      run_queue: () => run_queue()
    })
  )

  const queue = use_queue({
    mount_workers: workers.mount_workers,
    unmount_workers: workers.unmount_workers,
    vectorize,
    reset,
    resize_to_blob
  })

  run_queue = queue.process_queue

  const file_input = use_file_input(image_picker, queue.add_to_queue)

  // ---- Lifecycle ----
  if (instance) dismount(unmount)

  return {
    vVectorizer: file_input.v_vectorizer,
    unmount,
    select_photo: file_input.select_photo,
    open_selfie_camera: file_input.open_selfie_camera,
    open_camera: file_input.open_camera,
    image_picker,
    vectorize,
    vectorizer: workers.vectorizer,
    gradienter: workers.gradienter,
    tracer: workers.tracer,
    working,
    new_vector,
    new_gradients,
    source_image_url,
    mount_workers: workers.mount_workers,
    progress,
    reset,
    queue_items: computed(() => queue_items.value),
    current_processing: computed(() => current_processing.value),
    is_processing: computed(() => is_processing.value),
    completed_posters: computed(() => completed_posters.value),
    add_to_queue: queue.add_to_queue,
    queue_supported_files: file_input.queue_supported_files,
    queue_supported_clipboard_items: file_input.queue_supported_clipboard_items,
    init_processing_queue: queue.init_processing_queue,
    cleanup_queue_item
  }
}
