/** @typedef {import('@/types').Poster} Poster */
/** @typedef {import('@/types').Relation} Relation */
/** @typedef {import('@/types').PersonQuery} PersonQuery */
/** @typedef {import('@/types').Created} Created */
/** @typedef {import('@/types').Id} Id */

import {
  ref,
  computed,
  watch,
  onMounted as mounted,
  onUnmounted as unmounted,
  getCurrentInstance as current_instance,
  nextTick as tick
} from 'vue'
import {
  useIntersectionObserver as _use_intersect,
  useStorage as use_storage,
  usePointer as use_pointer,
  useMagicKeys
} from '@vueuse/core'
import {
  as_query_id,
  as_fragment_id,
  load,
  as_created_at,
  as_author
} from '@/utils/itemid'
import { as_directory } from '@/persistance/Directory'
import { recent_item_first } from '@/utils/sorting'
import { use as use_path } from '@/use/path'
import { Poster as PosterClass } from '@/persistance/Storage'
import {
  slice as slice_preference,
  storytelling,
  slice_alignment
} from '@/utils/preference'

export const geology_layers = ['sediment', 'sand', 'gravel', 'rock', 'boulder']
export const use = () => {
  const { props, emit } = current_instance()
  const vector = ref(null)
  const vector_element = ref(null)
  const intersecting = ref(false)
  const working = ref(true)
  const menu = ref(false)
  const { get_active_path } = use_path()

  const magic_keys = useMagicKeys()

  const aspect_toggle = ref(false)
  const cutouts_loaded = ref(false)
  const loading_cutouts = ref(false)

  const ken_burns_vertical_position = ref(
    ['top', 'middle', 'bottom'][Math.floor(Math.random() * 3)]
  )
  const ken_burns_horizontal_position = ref(
    ['left', 'center', 'right'][Math.floor(Math.random() * 3)]
  )
  const ken_burns_axis = ref('y')

  const is_hovered = ref(false)
  const storage_key = computed(() => `viewbox-${props.itemid}`)
  const viewbox_transform = use_storage(storage_key, {
    x: 0,
    y: 0,
    scale: 1
  })

  const { x, y, pressure } = use_pointer({ target: vector_element })

  const ken_burns_signal = ref(0)
  let orientation_media = null

  const original_viewbox = computed(() => {
    if (!vector.value) return { x: 0, y: 0, width: 16, height: 16 }
    const [x, y, width, height] = vector.value.viewbox.split(' ').map(Number)
    return { x, y, width, height }
  })

  const dynamic_viewbox = computed(() => {
    const { x, y, width, height } = original_viewbox.value
    const { x: dx, y: dy, scale } = viewbox_transform.value

    const new_width = width / scale
    const new_height = height / scale
    const new_x = x + dx / scale
    const new_y = y + dy / scale

    return `${new_x} ${new_y} ${new_width} ${new_height}`
  })

  // Gesture state
  let is_dragging = false
  const start_x = 0
  const start_y = 0
  const start_transform = null
  const touch_start_distance = 0
  const touch_start_scale = 1

  const aspect_ratio = computed(() => {
    if (slice_preference.value) {
      const alignment = slice_alignment.value || 'ymid'
      let y_align = 'Mid'
      if (alignment === 'ymin') y_align = 'Min'
      else if (alignment === 'ymax') y_align = 'Max'
      return `xMidY${y_align} slice`
    }
    return 'xMidYMid meet'
  })

  const itemid = computed(() => props.itemid)

  const should_ken_burns = computed(
    () => storytelling.value && slice_preference.value
  )

  const ken_burns_range = computed(() => {
    ken_burns_signal.value
    if (!vector_element.value || !vector.value) return 0

    const viewbox_parts = vector.value.viewbox.split(' ').map(Number)
    const content_width = viewbox_parts[2]
    const content_height = viewbox_parts[3]
    const content_aspect = content_width / content_height

    const container_rect = vector_element.value.getBoundingClientRect()
    const container_aspect = container_rect.width / container_rect.height

    // Vertical panning: available when content is taller than container
    const vertical_range = (() => {
      if (content_aspect < container_aspect) {
        const scale = container_rect.width / content_width
        const scaled_height = content_height * scale
        const overflow = scaled_height - container_rect.height
        const pan_range = (overflow / 2 / scaled_height) * 100
        return Math.max(0, pan_range)
      }
      return 0
    })()

    // Horizontal panning: available when content is wider than container
    const horizontal_range = (() => {
      if (content_aspect > container_aspect) {
        const scale = container_rect.height / content_height
        const scaled_width = content_width * scale
        const overflow = scaled_width - container_rect.width
        const pan_range = (overflow / 2 / scaled_width) * 100
        return Math.max(0, pan_range)
      }
      return 0
    })()

    // Choose axis with available range
    if (vertical_range > 0) {
      ken_burns_axis.value = 'y'
      return vertical_range
    }
    if (horizontal_range > 0) {
      ken_burns_axis.value = 'x'
      return horizontal_range
    }
    return 0
  })

  const ken_burns_position = computed(() => {
    if (ken_burns_axis.value === 'x') return ken_burns_horizontal_position.value

    return ken_burns_vertical_position.value
  })

  const bump_ken_burns = () => {
    ken_burns_signal.value += 1
  }

  const landscape = computed(() => {
    if (!vector.value) return false
    const numbers = vector.value.viewbox.split(' ')
    const width = parseInt(numbers[2])
    const height = parseInt(numbers[3])
    return width > height
  })

  const path = computed(() => {
    if (working.value || vector) return null
    if (Array.isArray(vector.value.path)) return vector.value.path
    return [vector.value.path]
  })

  const viewbox = computed(() => {
    if (vector.value) return vector.value.viewbox
    return '0 0 16 16' // this is the viewbox for silhouette
  })

  const tabindex = computed(() => {
    if (props.tabable) return 0
    return -1
  })

  const focusable = computed(
    () =>
      // if (!props.tabable) return 0
      -1
  )

  const query = add => {
    if (!vector.value) return add
    if (add) return `${as_query_id(vector.value.id)}-${add}`
    return as_query_id(vector.value.id)
  }

  const fragment = add => {
    if (!vector.value) return add
    if (add) return `${as_fragment_id(vector.value.id)}-${add}`
    return as_fragment_id(vector.value.id)
  }

  const click = () => {
    if (magic_keys.shift.value) aspect_toggle.value = !aspect_toggle.value
    menu.value = !menu.value
    emit('click', menu.value)
  }

  mounted(() => {
    if (!window?.matchMedia) return
    orientation_media = window.matchMedia('(orientation: portrait)')
    orientation_media.addEventListener('change', bump_ken_burns)
    bump_ken_burns()
  })

  const show = async () => {
    if (!vector.value) {
      const poster = await load(/** @type {Id} */ (props.itemid))
      if (!vector.value) vector.value = poster
    }
    await tick()
    working.value = false
    emit('show', vector.value)
  }

  const focus = layer => {
    console.info('focus', layer)
    get_active_path()
    emit('focus', layer)
  }

  const focus_cutout = event => {
    console.info('focus_cutout', event)
  }

  const down = event => {
    console.info('down', event)
  }

  const move = event => {
    console.info('move', event)
  }

  const up = () => {
    is_dragging = false
    is_hovered.value = false
    console.info('up', is_dragging, is_hovered.value)
  }

  const wheel = _event => {}

  const reset = () => {
    viewbox_transform.value = { x: 0, y: 0, scale: 1 }
  }

  const touch_dist = touches => {
    console.info('touch_dist', touches)
  }

  const touch_start = event => {
    console.info('touch_start', event)
  }

  const touch_move = event => {
    console.info('touch_move', event)
  }

  const touch_end = event => {
    console.info('touch_end', event)
  }

  const cutout_start = (event, index) => {
    console.info('cutout_start', event, index)
  }

  const cutout_end = event => {
    console.info('cutout_end', event)
  }

  watch(
    () => storytelling.value,
    () => bump_ken_burns()
  )

  unmounted(() => {
    if (orientation_media)
      orientation_media.removeEventListener('change', bump_ken_burns)
  })

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
    itemid,
    path,
    viewbox,
    working,
    show,
    focus,
    focus_cutout,
    tabindex,
    focusable,
    is_hovered,
    storage_key,
    viewbox_transform,
    x,
    y,
    pressure,
    original_viewbox,
    dynamic_viewbox,
    is_dragging,
    start_x,
    start_y,
    start_transform,
    touch_start_distance,
    touch_start_scale,
    geology_layers,
    down,
    move,
    up,
    wheel,
    reset,
    touch_dist,
    touch_start,
    touch_move,
    touch_end,
    cutout_start,
    cutout_end,
    aspect_toggle,
    should_ken_burns,
    ken_burns_range,
    ken_burns_position,
    ken_burns_axis
  }
}

export const use_posters = () => {
  const posters = ref([])
  const authors = ref([])

  /**
   * @param {PersonQuery} query
   */
  const for_person = async query => {
    const directory = await as_directory(`${query.id}/posters`)
    directory.items.forEach(created_at => {
      const poster_id = `${query.id}/posters/${created_at}`
      if (!posters.value.find(p => p.id === poster_id))
        posters.value.push({
          id: poster_id,
          type: 'posters'
        })
    })
    const existing_author = authors.value.find(a => a.id === query.id)
    if (existing_author) existing_author.viewed = ['index']
    else
      authors.value.push({
        id: query.id,
        type: 'person',
        name: '',
        avatar: '',
        viewed: ['index'],
        visited: null
      })
    posters.value.sort(recent_item_first)
  }

  /**
   * @param {Poster} poster
   */
  const poster_shown = async poster => {
    const author_id = as_author(poster.id)

    const author_posters = posters.value.filter(
      p => author_id === as_author(p.id)
    )

    const is_oldest_poster =
      as_created_at(poster.id) ===
      as_created_at(author_posters[author_posters.length - 1].id)

    if (!is_oldest_poster) return

    const author = authors.value.find(relation => relation.id === author_id)
    if (!author) return

    const next_archive = await get_next_unviewed_archive(
      author_id,
      author.viewed
    )
    if (!next_archive) return

    const new_posters = await load_archive_posters(author_id, next_archive)
    posters.value.push(...new_posters)
    posters.value.sort(recent_item_first)
    author.viewed.push(next_archive)
  }

  return {
    for_person,
    posters,
    poster_shown
  }
}

const path_names = ['background', 'light', 'regular', 'medium', 'bold']
export const is_click = menu => typeof menu === 'boolean'
export const is_focus = layer => path_names.some(name => name === layer)

/**
 * @param {string} author_id
 * @param {string[]} viewed
 * @returns {Promise<string|null>}
 */
const get_next_unviewed_archive = async (author_id, viewed) => {
  const directory = await as_directory(`${author_id}/posters`)
  if (!directory?.archive || !Array.isArray(directory.archive)) return null

  const unviewed = directory.archive.filter(
    archive => !viewed.includes(archive)
  )
  return unviewed.pop() || null
}

/**
 * @param {string} author_id
 * @param {number} archive_id
 * @returns {Promise<Poster[]>}
 */
const load_archive_posters = async (author_id, archive_id) => {
  const archive = await as_directory(`${author_id}/posters/${archive_id}/`)
  return archive.items.map(created_at => ({
    id: `${author_id}/posters/${created_at}`,
    type: 'posters'
  }))
}

/**
 * @param {Id} itemid
 * @returns {boolean}
 */
export const is_vector_id = itemid => {
  if (as_created_at(itemid)) return true
  return false
}

/**
 * @param {Poster} vector
 * @returns {boolean}
 */
export const is_vector = vector => {
  if (!vector || typeof vector !== 'object') return false
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
  return false
}

export const is_rect = rect => {
  if (typeof rect !== 'object') return false
  if (rect instanceof SVGRectElement) return true
  return false
}
export const is_stop = stop => {
  if (typeof stop !== 'object') return false
  if (stop instanceof SVGStopElement) return true
  return false
}
export const is_url_query = query => {
  if (typeof query !== 'string') return false
  if (query.startsWith('url(') && !query.endsWith(')')) return false
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
