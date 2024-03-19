import {
  as_query_id,
  as_fragment_id,
  load,
  as_created_at,
  as_directory
} from '@/use/itemid'
import { ref, computed, getCurrentInstance as current_instance } from 'vue'
import { useIntersectionObserver as use_intersect } from '@vueuse/core'
import { recent_item_first } from '@/use/sorting'
import { use as use_path } from '@/use/path'
const path_names = ['background', 'light', 'regular', 'medium', 'bold']
export const is_click = menu => typeof menu === 'boolean'
export const is_focus = layer => path_names.some(name => name === layer)
export const is_vector = vector => {
  if (typeof vector != 'object') return false
  if (!is_vector_id(vector.id)) return false
  if (vector.path) return false
  if (!vector.viewbox) return false
  if (!vector.height || !vector.width) return false
  if (!vector.regular) return false // the only required path

  if (vector.gradients) {
    if (!vector.gradients.width) return false
    if (!vector.gradients.height) return false
    if (!vector.gradients.radial) return false
  }
  if (vector.type === 'posters') return true
  else return false
}
export const is_vector_id = itemid => {
  if (as_created_at(itemid)) return true
  else return false
}
export const is_rect = rect => {
  if (typeof rect != 'object') return false
  if (rect instanceof SVGRectElement) return true
  else return false
}
export const is_stop = stop => {
  if (typeof stop != 'object') return false
  if (stop instanceof SVGStopElement) return true
  else return false
}
export const is_url_query = query => {
  if (typeof query != 'string') return false
  if (query.startsWith('url(')) {
    if (!query.endsWith(')')) return false
  }
  return true
}
export const set_vector_dimensions = (props, item) => {
  props.viewbox = item.getAttribute('viewBox')
  const dimensions = props.viewbox.split(' ')
  let width = item.getAttribute('width')
  let height = item.getAttribute('height')
  if (!width) width = dimensions[2]
  if (!height) height = dimensions[3]
  props.width = width
  props.height = height
}
const migrate_path = path => {
  const fill = path.getAttribute('fill')
  const opacity = path.getAttribute('fill-opacity')
  const rule = path.getAttribute('fill-rule')

  if (fill) path.style.fill = fill
  if (opacity) path.style.fillOpacity = opacity
  if (rule) path.style.fillRule = rule

  return path
}
const migrate_poster = poster => {
  if (Array.isArray(poster.path)) {
    poster.light = migrate_path(poster.path[0])
    poster.regular = migrate_path(poster.path[1])
    poster.medium = migrate_path(poster.path[2])
    poster.bold = migrate_path(poster.path[3])
  } else poster.bold = migrate_path(poster.path)
  poster.path = undefined
  return poster
}

export const use_poster = () => {
  const { props, emit } = current_instance()
  const vector = ref(null)
  const vector_element = ref(null)
  const intersecting = ref(false)
  const working = ref(true)
  const menu = ref(false)
  const { get_active_path } = use_path()
  const aspect_ratio = computed(() => {
    if (!props.toggle_aspect) return 'xMidYMid slice'
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

  const query = add => {
    if (!vector.value) return add
    if (add) return `${as_query_id(vector.value.id)}-${add}`
    else return as_query_id(vector.value.id)
  }
  const fragment = add => {
    if (!vector.value) return add
    if (add) return `${as_fragment_id(vector.value.id)}-${add}`
    else return as_fragment_id(vector.value.id)
  }
  const click = () => {
    menu.value = !menu.value
    emit('click', menu.value)
  }
  const show = async () => {
    if (!vector.value) {
      let poster = await load(props.itemid)
      if (poster.path) poster = migrate_poster(poster)
      vector.value = poster
    }
    working.value = false
    use_intersect(
      vector_element,
      ([{ isIntersecting }]) => {
        if (isIntersecting) {
          intersecting.value = true
        } else intersecting.value = false
      },
      { rootMargin: '0%' }
    )
    emit('loaded', vector.value)
  }
  const tabindex = computed(() => {
    if (props.tabable) return 0
    else return -1
  })
  const focusable = computed(() => {
    if (!props.tabable) return 0
    else return undefined
  })
  const focus = async layer => {
    get_active_path()
    emit('focus', layer)
  }
  return {
    vector,
    vector_element,
    intersecting,
    click,
    menu,
    query,
    fragment,
    landscape,
    aspect_ratio,
    path,
    viewbox,
    working,
    show,
    focus,
    tabindex,
    focusable
  }
}
export const use_posters = () => {
  const posters = ref([])
  const for_person = async person => {
    const directory = await as_directory(`${person.id}/posters`)
    directory.items.forEach(created_at => {
      posters.value.push({
        id: `${person.id}/posters/${created_at}`,
        type: 'posters'
      })
    })
    posters.value.sort(recent_item_first)
  }
  return {
    for_person,
    posters
  }
}
