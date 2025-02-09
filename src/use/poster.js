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
import { useIntersectionObserver as use_intersect } from '@vueuse/core'
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
  /** @type {import('vue').Ref<Poster[]>} */
  const posters = ref([])
  /** @type {import('vue').Ref<Relation[]>} */
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
 * @param {string} archive_id
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
