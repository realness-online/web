import { ref, computed, watch, onUnmounted as dismount } from 'vue'
import { create_path_element } from '@/use/path'
import { is_vector } from '@/use/vector'
import { as_created_at } from '@/use/itemid'
const new_vector = ref(null)
const new_gradients = ref(null)

import { useRouter as use_router } from 'vue-router'
export const use = () => {
  const router = use_router()
  const image_picker = ref(null)
  const working = ref(true)
  const vectorizer = ref(null)
  const gradienter = ref(null)

  const can_add = computed(() => {
    if (working.value || new_vector.value) return false
    else return true
  })
  const as_new_itemid = computed(() => {
    if (new_vector.value && new_vector.value.id) return new_vector.value.id
    else return `${localStorage.me}/posters/${Date.now()}`
  })

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
    path.style.fillOpacity = path_data.fillOpacity
    path.style.fillRule = 'evenodd'
    return path
  }
  const listener = () => {
    const image = image_picker.value.files[0]
    if (image === undefined) return

    const is_image = ['image/jpeg', 'image/png'].some(type => {
      return image.type === type
    })
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

  const vectorize = image => {
    console.time('makes:poster')
    working.value = true
    vectorizer.value.postMessage({ image })
    gradienter.value.postMessage({ image })
  }
  const vectorized = response => {
    const vector = response.data.vector
    vector.id = as_new_itemid
    vector.type = 'posters'
    vector.light = make_path(vector.light)
    vector.regular = make_path(vector.regular)
    vector.bold = make_path(vector.bold)
    new_vector.value = vector
  }
  const gradientized = message => (new_gradients.value = message.data.gradients)
  const mount_workers = () => {
    vectorizer.value = new Worker('/vector.worker.js')
    gradienter.value = new Worker('/gradient.worker.js')
    vectorizer.value.addEventListener('message', vectorized)
    gradienter.value.addEventListener('message', gradientized)
  }
  watch(new_vector, () => {
    if (
      new_gradients.value &&
      new_vector.value &&
      is_vector(new_vector.value)
    ) {
      console.timeEnd('makes:poster')
      const created_at = as_created_at(new_vector.value.id)
      router.push({ path: `/posters/${created_at}/editor` })
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
