import {
  ref,
  computed,
  watchEffect as watch_effect,
  onUnmounted as dismount,
  inject
} from 'vue'
import { create_path_element } from '@/use/path'
import { is_vector } from '@/use/poster'
import { as_created_at } from '@/utils/itemid'
import { useRouter as use_router } from 'vue-router'
import { to_kb } from '@/utils/numbers'
import { IMAGE } from '@/utils/numbers'
import ExifReader from 'exifreader'

/**
 * @typedef {Object} VectorResponse
 * @property {Object} data
 * @property {Object} data.vector
 */

const new_vector = ref(null)
const new_gradients = ref(null)
const progress = ref(0)

export const use = () => {
  const router = use_router()
  const image_picker = inject('image-picker', ref(null))
  const working = ref(false)
  const vectorizer = ref(null)
  const gradienter = ref(null)
  const tracer = ref(null)

  const can_add = computed(() => {
    if (working.value || new_vector.value) return false
    return true
  })

  const as_new_itemid = computed(
    () => `${localStorage.me}/posters/${Date.now()}`
  )

  const select_photo = () => {
    image_picker.value.removeAttribute('capture')
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
   * @param {ImageBitmap} image
   * @param {number} [target_size=IMAGE.TARGET_SIZE]
   * @returns {ImageData}
   */
  const resize_image = (image, target_size = IMAGE.TARGET_SIZE) => {
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

  const listener = () => {
    const [image] = image_picker.value.files
    if (image === undefined) return
    const is_image = ['image/jpeg', 'image/png'].some(
      type => image.type === type
    )
    if (is_image) {
      vectorize(image)
      image_picker.value.value = ''
    }
  }

  const vVectorizer = {
    /**
     * @param {Object} input
     * @param {Object} binding
     */
    mounted: (input, binding) => {
      input.addEventListener('change', listener)
    }
  }

  /**
   * @param {File} image
   */
  const vectorize = async image => {
    working.value = true
    progress.value = 0

    const tags = await ExifReader.load(image, { expanded: true })
    const exif = exif_logger(tags)

    // Create ImageBitmap and resize once
    const array_buffer = await image.arrayBuffer()
    const blob = new Blob([array_buffer])
    const image_bitmap = await createImageBitmap(blob)
    const resized_image_data = resize_image(image_bitmap)

    // Send resized image data to workers
    vectorizer.value.postMessage({
      route: 'make:vector',
      image_data: resized_image_data,
      exif
    })
    gradienter.value.postMessage({
      route: 'make:gradient',
      image_data: resized_image_data
    })
    tracer.value.postMessage({
      route: 'make:trace',
      image_data: resized_image_data
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
    vector.id = as_new_itemid
    vector.type = 'posters'
    vector.light = make_path(vector.light)
    vector.regular = make_path(vector.regular)
    vector.medium = make_path(vector.medium)
    vector.bold = make_path(vector.bold)
    new_vector.value = vector
  }
  const gradientized = message => (new_gradients.value = message.data.gradients)

  /**
   * Handles messages from the tracer worker
   * @param {Object} message - Message from tracer worker
   * @description
   * The tracer worker sends cutout data as objects with d, color, and offset properties.
   * When tracing completes, we convert these objects to SVG path elements to maintain
   * consistency with the main paths (light, regular, medium, bold) and enable SVGO optimization.
   */
  const traced = message => {
    switch (message.data.type) {
      case 'progress':
        progress.value = message.data.progress
        break
      case 'path':
        if (!new_vector.value.cutout) new_vector.value.cutout = []
        new_vector.value.cutout.push(
          make_cutout_path({
            ...message.data.path,
            progress: progress.value
          })
        )
        break
      case 'complete':
        console.log('Tracer complete:', message.data)
        if (new_vector.value && !new_vector.value.optimized)
          new_vector.value.completed = true
        break
      case 'error':
        console.error('Tracer error:', message.error)
        break
    }
  }

  const mount_workers = () => {
    vectorizer.value = new Worker('/vector.worker.js')
    gradienter.value = new Worker('/vector.worker.js')
    tracer.value = new Worker('/tracer.worker.js')
    vectorizer.value.addEventListener('message', vectorized)
    gradienter.value.addEventListener('message', gradientized)
    tracer.value.addEventListener('message', traced)
  }

  watch_effect(() => {
    if (
      new_gradients.value &&
      new_vector.value &&
      is_vector(new_vector.value)
    ) {
      const created_at = as_created_at(new_vector.value.id)
      router.push({ path: `/posters/${created_at}/editor` })
    }
  })
  dismount(() => {
    if (vectorizer.value) vectorizer.value.terminate()
    if (gradienter.value) gradienter.value.terminate()
    if (tracer.value) tracer.value.terminate()
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
    working,
    new_vector,
    new_gradients,
    mount_workers,
    progress
  }
}
