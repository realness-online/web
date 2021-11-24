import { as_query_id, load, as_author, as_created_at } from '@/helpers/itemid'
import { ref, computed, watchEffect } from 'vue'

const path_names = ['background', 'bold', 'regular', 'light']
export const is_click = menu => typeof menu === 'boolean'
export const is_focus = layer => path_names.any(name => name === layer)
export const is_vector = vector => {
  if (typeof vector != 'object') return false
  if (!is_vector_id(vector?.id)) return false
  if (!vector?.viewbox) return false
  if (!vector?.height || !vector?.width) return false
  if (
    !vector?.background ||
    !vector?.bold ||
    !vector?.regular ||
    !vector?.light
  )
    return false
  if (vector?.type === 'posters' || vector.type === 'avatars') return true
  else return false
}

export const is_vector_id = itemid => {
  if (as_author(itemid) && as_created_at(itemid)) return true
  else return false
}
export function as_poster(props, emit) {
  const vector = ref(null)
  const working = ref(true)
  const menu = ref(false)

  const aspect_ratio = computed(() => {
    if (menu.value || !props.slice) return 'xMidYMid meet'
    else return 'xMidYMid slice'
  })
  const landscape = computed(() => {
    if (!vector.value) return false
    const numbers = vector.value.viewbox.split(' ')
    const width = parseInt(numbers[2])
    const height = parseInt(numbers[3])
    return width > height
  })
  const path = computed(() => {
    if (working.value || vector) return null
    // then always return a list
    if (Array.isArray(vector.value.path)) return vector.value.path
    else return [vector.value.path]
  })
  const viewbox = computed(() => {
    if (vector.value) return vector.value.viewbox
    else return '0 0 16 16' // this is the viewbox for silhouette
  })
  const id = computed(() => {
    if (vector.value) return as_query_id(vector.value.id)
    else return 'new-poster'
  })
  const fragment = computed(() => {
    return `#${id.value}`
  })
  const click = () => emit('click', menu)
  const show = async () => {
    if (!vector.value) await load(props.itemid)
    working.value = false
    emit('loaded', vector.value)
  }

  const tabindex = computed(() => {
    if (props.tabable) return 0
    else return undefined
  })
  const focusable = computed(() => {
    if (!props.tabable) return 0
    else return undefined
  })
  const focus = async layer => {
    emit('focus', layer)
  }
  const should_show = () => {
    if (props.immediate) show()
  }
  watchEffect(() => {
    if (props.poster && !vector.value) vector.value = props.poster
  })

  return {
    vector,
    click,
    menu,
    id,
    fragment,
    landscape,
    aspect_ratio,
    path,
    viewbox,
    working,
    show,
    should_show,
    focus,
    tabindex,
    focusable
  }
}
