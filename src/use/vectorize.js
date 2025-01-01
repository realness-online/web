import {
  ref,
  computed,
  watchEffect as watch_effect,
  onUnmounted as dismount
} from 'vue'
import { create_path_element } from '@/use/path'
import { is_vector } from '@/use/vector'
import { as_created_at } from '@/use/itemid'
import { useRouter as use_router } from 'vue-router'
import { to_kb } from '@/use/number'
import ExifReader from 'exifreader'
const new_vector = ref(null)
const new_gradients = ref(null)

export const use = () => {
  const router = use_router()
  const image_picker = ref(null)
  const working = ref(false)
  const vectorizer = ref(null)
  const gradienter = ref(null)

  const can_add = computed(() => {
    if (working.value || new_vector.value) return false
    else return true
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
    const image = image_picker.value.files[0]
    if (image === undefined) return
    const is_image = ['image/jpeg', 'image/png'].some(type => image.type === type)
    if (is_image) {
      vectorize(image)
      image_picker.value.value = ''
    }
  }
  const vVectorizer = {
    mounted: (input, binding) => {
      input.addEventListener('change', event => listener(input, binding, event))
    }
  }

  const vectorize = async image => {
    working.value = true

    const tags = await ExifReader.load(image, { expanded: true })
    const exif = exif_logger(tags)

    vectorizer.value.postMessage({ route: 'make:vector', image, exif })
    gradienter.value.postMessage({ route: 'make:gradient', image })
  }

  const exif_logger = tags => {
    const cloned = structuredClone(tags)
    console.log('EXIF: ', `${to_kb(cloned)}kb`, cloned)
    return cloned
  }

  const vectorized = response => {
    const {vector} = response.data
    vector.id = as_new_itemid
    vector.type = 'posters'
    vector.light = make_path(vector.light)
    vector.regular = make_path(vector.regular)
    vector.medium = make_path(vector.medium)
    vector.bold = make_path(vector.bold)
    new_vector.value = vector
  }
  const gradientized = message => (new_gradients.value = message.data.gradients)
  const mount_workers = () => {
    vectorizer.value = new Worker('/vector.worker.js')
    gradienter.value = new Worker('/vector.worker.js')
    vectorizer.value.addEventListener('message', vectorized)
    gradienter.value.addEventListener('message', gradientized)
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
    mount_workers
  }
}
