import {
  ref,
  computed,
  watch,
  onMounted as mounted,
  onUnmounted as dismount
} from 'vue'
import { create_path_element } from '@/use/path-style'
const new_vector = ref(null)
import get_item from '@/use/item'
export const use = () => {
  const image_picker = ref(null)
  const new_gradients = ref(null)
  const working = ref(true)
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
  const upload = () => {
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
      input.addEventListener('change', event => upload(input, binding, event))
    }
  }
  const can_add = computed(() => {
    if (working.value || new_vector.value) return false
    else return true
  })
  const as_new_itemid = computed(() => {
    if (new_vector.value && new_vector.value.id) return new_vector.value.id
    else return `${localStorage.me}/posters/${Date.now()}`
  })
  const make_path = path_data => {
    const path = create_path_element()
    path.setAttribute('d', path_data.d)
    path.style.fillOpacity = path_data.fillOpacity
    path.style.fillRule = 'evenodd'
    return path
  }

  const vectorizer = new Worker('/vector.worker.js')
  const vectorize = image => {
    console.time('makes:poster')
    working.value = true
    vectorizer.postMessage({ image })
    gradienter.postMessage({ image })
  }
  const vectorized = response => {
    const vector = response.data.vector
    vector.id = as_new_itemid
    vector.type = 'posters'
    vector.light = make_path(vector.light)
    vector.regular = make_path(vector.regular)
    vector.bold = make_path(vector.bold)
    new_vector.value = vector
    working.value = false
  }

  const gradienter = new Worker('/gradient.worker.js')
  const gradientized = message => {
    new_gradients.value = message.data.gradients
  }

  const optimizer = new Worker('/optimize.worker.js')
  const optimize = vector => {
    optimizer.postMessage({ vector })
  }
  const optimized = message => {
    const optimized = get_item(message.data.vector)
    new_vector.value = optimized
    console.timeEnd('makes:poster')
  }
  mounted(async () => {
    vectorizer.addEventListener('message', vectorized)
    gradienter.addEventListener('message', gradientized)
    optimizer.addEventListener('message', optimized)
  })

  watch(new_vector, () => {
    if (new_vector.value) new_vector.value.gradients = new_gradients
  })
  dismount(() => {
    vectorizer.terminate()
    optimizer.terminate()
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
    optimizer,
    optimize,
    working,
    new_vector,
    new_gradients,
    as_new_itemid
  }
}
