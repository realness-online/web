import {
  as_query_id,
  as_fragment_id,
  load,
  as_author,
  as_created_at,
  as_directory
} from '@/use/itemid'
import { ref, computed, onMounted as mounted } from 'vue'
import { recent_item_first } from '@/use/sorting'
import { use as use_path } from '@/use/path'
const path_names = ['background', 'light', 'regular', 'bold']
export const is_click = menu => typeof menu === 'boolean'
export const is_focus = layer => path_names.some(name => name === layer)
export const is_vector = vector => {
  if (typeof vector != 'object') return false
  if (!is_vector_id(vector.id)) return false
  if (vector.path) return false
  if (!vector.viewbox) return false
  if (!vector.height || !vector.width) return false
  if (!vector.regular) return false // the only required path
  if (!vector.regular.style) return false
  if (vector.light && !vector.light.style) return false // have style if exist
  if (vector.bold && !vector.bold.style) return false
  if (vector.gradients) {
    if (!vector.gradients.width) return false
    if (!vector.gradients.height) return false
    if (!vector.gradients.radial) return false
    console.log('gradients are good')
  }
  if (vector.type === 'posters' || vector.type === 'avatars') return true
  else return false
}
export const is_vector_id = itemid => {
  if (as_author(itemid) && as_created_at(itemid)) return true
  else return false
}
export const is_rect = rect => {
  if (typeof rect != 'object') return false
  if (rect instanceof SVGRectElement) return true
  else return false
}
export const is_path = path => {
  if (typeof path != 'object') return false
  if (path instanceof SVGPathElement) return true
  else return false
}
export const is_stop = stop => {
  if (typeof stop != 'object') return false
  if (stop instanceof SVGStopElement) return true
  else return false
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
export const migrate_path = path => {
  const style = path.style
  const fill = path.getAttribute('fill')
  const opacity = path.getAttribute('fill-opacity')
  const rule = path.getAttribute('fill-rule')

  if (fill) style.fill = fill
  if (opacity) style.fillOpacity = opacity
  if (rule) style.fillRule = rule

  return path
}
export const migrate_poster = poster => {
  if (Array.isArray(poster.path)) {
    poster.light = migrate_path(poster.path[0])
    poster.regular = migrate_path(poster.path[1])
    poster.bold = migrate_path(poster.path[2])
  } else poster.bold = migrate_path(poster.path)
  poster.path = undefined
  return poster
}

export const use_poster = (props, emit) => {
  const vector = ref(null)
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
    console.log('dude')
    const path = get_active_path()
    console.log('howdy', path)
    selected_path.value = path.getAttribute('itemprop')
    opacity_percentage.value = path.style.fillOpacity
    emit('focus', layer)
  }
  const should_show = () => {
    if (props.immediate) show()
  }
  mounted(should_show)
  return {
    vector,
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
    should_show,
    focus,
    tabindex,
    focusable
  }
}

export const use_posters = () => {
  const posters = ref([])
  const for_person = async person => {
    const [post, avatars] = await Promise.all([
      as_directory(`${person.id}/posters`),
      as_directory(`${person.id}/avatars`)
    ])
    post.items.forEach(created_at => {
      posters.value.push({
        id: `${person.id}/posters/${created_at}`,
        type: 'posters'
      })
    })
    avatars.items.forEach(created_at => {
      posters.value.push({
        id: `${person.id}/avatars/${created_at}`,
        type: 'avatars'
      })
    })
    posters.value.sort(recent_item_first)
  }
  return {
    for_person,
    posters
  }
}
