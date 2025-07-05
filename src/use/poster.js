/** @typedef {import('@/types').Poster} Poster */
/** @typedef {import('@/types').Relation} Relation */
/** @typedef {import('@/types').Created} Created */
/** @typedef {import('@/types').Id} Id */

import {
  ref,
  computed,
  getCurrentInstance as current_instance,
  nextTick as tick
} from 'vue'
import {
  useIntersectionObserver as use_intersect,
  useStorage as use_storage,
  usePointer as use_pointer
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

export const use = () => {
  const { props, emit } = current_instance()
  const vector = ref(null)
  const vector_element = ref(null)
  const intersecting = ref(false)
  const working = ref(true)
  const menu = ref(false)
  const { get_active_path } = use_path()

  // Pan and zoom state
  const is_hovered = ref(false)
  const storage_key = computed(() => `viewbox-${props.itemid}`)
  const viewbox_transform = use_storage(storage_key, {
    x: 0,
    y: 0,
    scale: 1
  })

  // Pointer tracking
  const { x, y, pressure } = use_pointer({ target: vector_element })

  // Original viewBox values
  const original_viewbox = computed(() => {
    if (!vector.value) return { x: 0, y: 0, width: 16, height: 16 }
    const [x, y, width, height] = vector.value.viewbox.split(' ').map(Number)
    return { x, y, width, height }
  })

  // Computed viewBox with transforms
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
  let start_x = 0
  let start_y = 0
  let start_transform = null
  let touch_start_distance = 0
  let touch_start_scale = 1

  const aspect_ratio = computed(() => {
    if (!props.toggle_aspect) return 'xMidYMid slice'
    if (menu.value || !props.slice) return 'xMidYMid meet'
    return 'xMidYMid slice'
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

  const focusable = computed(() => {
    if (!props.tabable) return 0
    return undefined
  })

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
    menu.value = !menu.value
    emit('click', menu.value)
  }

  const focus = layer => {
    get_active_path()
    emit('focus', layer)
  }

  const focus_cutout = event => {
    console.log('focus_cutout', event)
  }

  const show = async () => {
    if (!vector.value) {
      const poster = await load(/** @type {Id} */ (props.itemid))
      if (!vector.value) vector.value = poster
    }
    await tick()
    working.value = false
    use_intersect(
      vector_element,
      ([{ isIntersecting }]) => {
        if (isIntersecting) intersecting.value = true
        else intersecting.value = false
      },
      { rootMargin: '0%' }
    )
    emit('show', vector.value)
  }

  const down = event => {
    is_dragging = true
    start_x = event.clientX
    start_y = event.clientY
    start_transform = { ...viewbox_transform.value }
    is_hovered.value = true
  }

  const move = event => {
    if (!is_dragging) return

    const delta_x = event.clientX - start_x
    const delta_y = event.clientY - start_y

    viewbox_transform.value = {
      ...start_transform,
      x: start_transform.x + delta_x,
      y: start_transform.y + delta_y
    }
  }

  const up = () => {
    is_dragging = false
    is_hovered.value = false
  }

  const wheel = event => {
    // console.log('wheel', event)
  }

  const reset = () => {
    viewbox_transform.value = { x: 0, y: 0, scale: 1 }
  }

  const touch_dist = touches => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const touch_start = event => {
    console.log('touch_start', event.touches)
    if (event.touches.length === 2) {
      touch_start_distance = touch_dist(event.touches)
      touch_start_scale = viewbox_transform.value.scale
    } else if (event.touches.length === 1) {
      down(event.touches[0])
    }
  }

  const touch_move = event => {
    console.log('touch_move', event.touches)
  }

  const touch_end = event => {
    console.log('touch_end', event.touches)
    if (event.touches.length === 0) up()
  }

  const cutout_start = (event, index) => {
    console.log('cutout_start', event.touches, index)
  }

  const cutout_end = event => {
    console.log('cutout_end', event.touches)
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
    cutout_end
  }
}

export const use_posters = () => {
  const posters = ref([])
  const authors = ref([])

  /**
   * @param {Relation} person
   */
  const for_person = async person => {
    const directory = await as_directory(`${person.id}/posters`)
    directory.items.forEach(created_at => {
      posters.value.push({
        id: `${person.id}/posters/${created_at}`,
        type: 'posters'
      })
    })
    person.viewed = ['index']
    authors.value.push(person)
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
 * @param {string} itemid
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
