import {
  ref,
  computed,
  watchEffect as watch_effect,
  onUnmounted as dismount
} from 'vue'
import { create_path_element } from '@/use/path'
import { is_vector } from '@/use/poster'
import { as_created_at } from '@/utils/itemid'
import { useRouter as use_router } from 'vue-router'
import { to_kb } from '@/utils/numbers'
import ExifReader from 'exifreader'

/**
 * @typedef {Object} VectorResponse
 * @property {Object} data
 * @property {Object} data.vector
 */

const new_vector = ref(null)
const new_gradients = ref(null)
const new_trace = ref(null)
const progress = ref(0)

export const use = () => {
  const router = use_router()
  const image_picker = ref(null)
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

    const tags = await ExifReader.load(image, { expanded: true })
    const exif = exif_logger(tags)

    vectorizer.value.postMessage({ route: 'make:vector', image, exif })
    gradienter.value.postMessage({ route: 'make:gradient', image })
    tracer.value.postMessage({ route: 'make:trace', image })
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
  const traced = message => {

    switch(message.type) {
      case 'progress':
        // Update progress indicator
        progress.value = message.progress
        break
      case 'path':
        // Add new path to trace
        console.log('path:', message.data)
        if(!new_vector.value.trace) {
          new_vector.value.trace = { paths: [] }
        }
        new_vector.value.trace.paths.push(message.data)
        break

      case 'complete':
        // Set final dimensions
        new_vector.value.width = message.width
        new_vector.value.height = message.height
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
      router.replace({ path: `/posters/${created_at}/editor` })
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
    new_trace,
    mount_workers,
    progress
  }
}
