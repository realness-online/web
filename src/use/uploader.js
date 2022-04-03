import {
  ref,
  computed,
  onMounted as mounted,
  onUnmounted as dismount
} from 'vue'
import { create_path_element } from '@/use/path-style'
import get_item from '@/use/item'
export const use = () => {
  const uploader = ref(null)
  const new_poster = ref(null)
  const working = ref(true)
  const vectorizer = new Worker('/vector.worker.js')
  const optimizer = new Worker('/optimize.worker.js')
  const select_photo = () => {
    uploader.value.removeAttribute('capture')
    uploader.value.click()
  }
  const open_selfie_camera = () => {
    uploader.value.setAttribute('capture', 'user')
    uploader.value.click()
  }
  const open_camera = () => {
    uploader.value.setAttribute('capture', 'environment')
    uploader.value.click()
  }
  const upload = (input, binding, event) => {
    const image = event.target.files[0]
    if (image === undefined) return
    const is_image = ['image/jpeg', 'image/png'].some(type => {
      return image.type === type
    })
    if (is_image) {
      vectorize(image)
      input.value = ''
    }
  }
  const vUploader = {
    mounted: (input, binding) => {
      input.addEventListener('change', event => upload(input, binding, event))
    }
  }
  const can_add = computed(() => {
    if (working.value || new_poster.value) return false
    else return true
  })
  const as_new_itemid = computed(() => {
    if (new_poster.value && new_poster.value.id) return new_poster.value.id
    else return `${localStorage.me}/posters/${Date.now()}`
  })
  const vectorize = image => {
    console.time('makes:poster')
    working.value = true
    vectorizer.postMessage({ image })
  }
  const vectorized = response => {
    const vector = response.data.vector
    vector.id = as_new_itemid
    vector.type = 'posters'
    vector.light = make_path(vector.light)
    vector.regular = make_path(vector.regular)
    vector.bold = make_path(vector.bold)
    new_poster.value = vector
    working.value = false
  }
  const make_path = path_data => {
    const path = create_path_element()
    path.setAttribute('d', path_data.d)
    path.style.fillOpacity = path_data.fillOpacity
    path.style.fillRule = 'evenodd'
    return path
  }
  const optimize = vector => {
    optimizer.postMessage({ vector })
  }
  const optimized = message => {
    const optimized = get_item(message.data.vector)
    new_poster.value = optimized
    console.timeEnd('makes:poster')
  }
  mounted(async () => {
    vectorizer.addEventListener('message', vectorized)
    optimizer.addEventListener('message', optimized)
  })
  dismount(() => {
    vectorizer.terminate()
    optimizer.terminate()
  })

  return {
    can_add,
    vectorize,
    vectorizer,
    optimizer,
    optimize,
    vUploader,
    uploader,
    as_new_itemid,
    working,
    new_poster,
    select_photo,
    open_selfie_camera,
    open_camera
  }
}
