/** @typedef {import('@/types').Poster} Poster */
/** @typedef {import('@/types').Path} Path */
/** @typedef {import('@/types').Relation} Relation */
/** @typedef {import('@/types').PersonQuery} PersonQuery */
/** @typedef {import('@/types').Created} Created */
/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Item} Item */
/** @typedef {Poster & {path?: Path | Path[]}} VectorLike */

import {
  ref,
  computed,
  inject,
  getCurrentInstance as current_instance,
  nextTick as tick
} from 'vue'
import { usePointer as use_pointer } from '@vueuse/core'
import {
  as_query_id,
  as_fragment_id,
  load,
  as_created_at,
  as_author
} from '@/utils/itemid'
import { recent_item_first } from '@/utils/sorting'
import { use as use_path } from '@/use/path'
import { aspect_ratio_mode, slice_alignment } from '@/utils/preference'
import {
  poster_landscape,
  poster_preserve_aspect_ratio
} from '@/use/poster-aspect'

/**
 * Lazy-load directory API so `itemid` / `serverless` do not form static cycles with Directory.
 * @param {import('@/types').Id} itemid
 */
const directory_for = async itemid => {
  const { as_directory } = await import('@/persistence/Directory')
  return as_directory(itemid)
}

export const geology_layers = [
  'sediment',
  'sand',
  'gravel',
  'rocks',
  'boulders'
]

// Composable manages poster display, editing, layers, SVG manipulation, and animations

export const use = () => {
  const instance = current_instance()
  const props = instance?.props ?? {}
  const emit = instance?.emit ?? (() => {})
  const vector = ref(/** @type {VectorLike | null} */ (null))
  const vector_element = ref(null)
  const intersecting = ref(false)
  const working = ref(true)
  const menu = ref(false)
  const { get_active_path } = use_path()

  const is_hovered = ref(false)

  const { x, y, pressure } = use_pointer({ target: vector_element })

  const original_viewbox = computed(() => {
    if (!vector.value) return { x: 0, y: 0, width: 16, height: 16 }
    const [x, y, width, height] = vector.value.viewbox.split(' ').map(Number)
    return { x, y, width, height }
  })

  // Gesture state
  let is_dragging = false
  const start_x = 0
  const start_y = 0
  const start_transform = null
  const touch_start_distance = 0
  const touch_start_scale = 1

  const aspect_ratio = computed(() =>
    poster_preserve_aspect_ratio({
      mode: aspect_ratio_mode.value,
      alignment: slice_alignment.value || 'ymid'
    })
  )

  const itemid = computed(() => props.itemid)

  const landscape = computed(() => poster_landscape(vector.value?.viewbox))

  const path = computed(() => {
    if (working.value || !vector.value) return null
    const v = vector.value
    if (Array.isArray(v.path)) return v.path
    if (v.path) return [v.path]
    return null
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
    const base = vector.value
      ? as_query_id(vector.value.id)
      : as_query_id(/** @type {Id} */ (itemid.value))
    if (add) return `${base}-${add}`
    return base
  }

  const fragment = add => {
    const base = vector.value
      ? as_fragment_id(vector.value.id)
      : as_fragment_id(/** @type {Id} */ (itemid.value))
    if (add) return `${base}-${add}`
    return base
  }

  const click = () => {
    menu.value = !menu.value
    emit('click', menu.value)
  }

  const show = async () => {
    if (!vector.value) {
      const poster = await load(/** @type {Id} */ (props.itemid))
      if (!vector.value && poster)
        vector.value = /** @type {VectorLike} */ (poster)
    }
    await tick()
    working.value = false
    emit('show', vector.value)
  }

  const focus = layer => {
    get_active_path()
    emit('focus', layer)
  }

  const focus_cutout = _event => {}

  const down = _event => {}

  const move = _event => {}

  const up = () => {
    is_dragging = false
    is_hovered.value = false
  }

  const wheel = _event => {}

  const reset = () => {}

  const touch_dist = _touches => {}

  const touch_start = _event => {}

  const touch_move = _event => {}

  const touch_end = _event => {}

  const cutout_start = (_event, _index) => {}

  const cutout_end = _event => {}

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
    x,
    y,
    pressure,
    original_viewbox,
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
    cutout_end
  }
}

export const use_posters = () => {
  const set_working = inject('set_working')
  const posters = ref(/** @type {Item[]} */ ([]))
  const authors = ref(/** @type {Relation[]} */ ([]))
  /** @type {Set<string>} */
  const loading_archives = new Set()

  /**
   * @param {PersonQuery} query
   */
  const for_person = async query => {
    if (set_working) set_working(true)
    try {
      const directory = await directory_for(
        /** @type {Id} */ (`${query.id}/posters`)
      )
      if (!directory) return
      console.info(
        `[posters] index for ${query.id}: ${directory.items.length} posters, ${directory.archive?.length ?? 0} archive pages`,
        { items: directory.items, archive: directory.archive }
      )
      directory.items.forEach(created_at => {
        const poster_id = `${query.id}/posters/${created_at}`
        if (!posters.value.find(p => p.id === poster_id))
          posters.value.push({
            id: /** @type {Id} */ (poster_id),
            type: 'posters'
          })
      })
      const existing_author = authors.value.find(a => a.id === query.id)
      if (!existing_author)
        authors.value.push({
          id: query.id,
          type: 'person',
          name: '',
          viewed: ['index'],
          visited: null
        })
      else if (!existing_author.viewed.includes('index'))
        existing_author.viewed.unshift('index')

      posters.value.sort(recent_item_first)
    } finally {
      if (set_working) set_working(false)
    }
  }

  /**
   * @param {Poster} poster
   */
  const poster_shown = async poster => {
    const author_id = as_author(poster.id)
    if (!author_id) return

    const author_posters = posters.value.filter(
      p => author_id === as_author(p.id)
    )
    const oldest = author_posters[author_posters.length - 1]
    if (!oldest) return

    const is_oldest_poster =
      as_created_at(poster.id) === as_created_at(oldest.id)
    if (!is_oldest_poster) return
    const author = authors.value.find(relation => relation.id === author_id)
    if (!author) return

    console.info(
      `[posters] oldest poster shown for ${author_id}: ${poster.id}`,
      { viewed: [...author.viewed], total_loaded: author_posters.length }
    )

    if (loading_archives.has(author_id)) {
      console.info(
        `[posters] guard: archive load already in flight for ${author_id}, skipping`
      )
      return
    }
    loading_archives.add(author_id)
    try {
      const next_archive = await get_next_unviewed_archive(
        author_id,
        author.viewed
      )
      if (!next_archive) {
        console.info(
          `[posters] no more archives for ${author_id} — all pages loaded`
        )
        return
      }

      const new_posters = await load_archive_posters(
        author_id,
        /** @type {number} */ (Number(next_archive))
      )
      const existing_ids = new Set(posters.value.map(p => p.id))
      const dupes = new_posters.filter(p => existing_ids.has(p.id))
      const unique_new = /** @type {Item[]} */ (
        new_posters.filter(p => !existing_ids.has(p.id))
      )
      if (dupes.length)
        console.warn(
          `[posters] DUPES in archive ${next_archive} for ${author_id}: ${dupes.length} already in posters.value`,
          dupes.map(p => p.id)
        )
      console.info(
        `[posters] loaded archive ${next_archive} for ${author_id}: ${unique_new.length} unique posters`,
        { total_after: author_posters.length + unique_new.length }
      )
      posters.value.push(...unique_new)
      posters.value.sort(recent_item_first)
      author.viewed.push(next_archive)
    } finally {
      loading_archives.delete(author_id)
    }
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
  const directory = await directory_for(
    /** @type {Id} */ (`${author_id}/posters`)
  )
  if (!directory?.archive || !Array.isArray(directory.archive)) return null

  const unviewed = directory.archive.filter(
    archive => !viewed.includes(String(archive))
  )
  const cached_result = String(unviewed.pop() || '') || null
  if (cached_result) return cached_result

  // Cached archive list exhausted — refresh from network
  console.info(
    `[posters] cached archives exhausted for ${author_id}, fetching fresh list`
  )
  try {
    const { load_directory_from_network } =
      await import('@/persistence/Directory')
    const fresh = await load_directory_from_network(
      /** @type {Id} */ (`${author_id}/posters`)
    )
    if (!fresh?.archive || !Array.isArray(fresh.archive)) return null
    const still_unviewed = fresh.archive.filter(
      archive => !viewed.includes(String(archive))
    )
    const result = String(still_unviewed.pop() || '') || null
    console.info(
      `[posters] network refresh ${result ? `found: ${result}` : 'exhausted'}`,
      {
        total_archives: fresh.archive.length,
        viewed: viewed.length,
        still_unviewed: still_unviewed.length
      }
    )
    return result
  } catch (e) {
    console.warn(`[posters] network refresh failed for ${author_id}:`, e)
    return null
  }
}

/**
 * @param {string} author_id
 * @param {number} archive_id
 * @returns {Promise<Poster[]>}
 */
const load_archive_posters = async (author_id, archive_id) => {
  const archive = await directory_for(
    /** @type {Id} */ (`${author_id}/posters/${archive_id}/`)
  )
  if (!archive) return []
  return /** @type {Poster[]} */ (
    archive.items.map(created_at => ({
      id: /** @type {Id} */ (
        `${author_id}/posters/${archive_id}/${created_at}`
      ),
      type: 'posters',
      background: '',
      light: '',
      regular: '',
      medium: '',
      bold: '',
      cutout: [],
      width: 0,
      height: 0,
      viewbox: '',
      optimized: false
    }))
  )
}

/**
 * Type guard for the svg prop (SVGSVGElement). Uses instanceof only so
 * validators pass under @vue/test-utils mounts without attachTo (detached DOM).
 * @returns {boolean}
 */
export const is_svg_valid = v => v instanceof SVGSVGElement

/**
 * @param {Id} itemid
 * @returns {boolean}
 */
export const is_vector_id = itemid => {
  if (as_created_at(itemid)) return true
  return false
}

/**
 * @param {Poster & {path?: unknown}} vector
 * @returns {boolean}
 */
export const is_vector = vector => {
  if (!vector || typeof vector !== 'object') return false
  if (!is_vector_id(vector.id)) return false
  if (vector.path) return false
  if (!vector.viewbox) return false
  if (!vector.height || !vector.width) return false

  const { gradients } = vector
  if (gradients) {
    if (!gradients.width) return false
    if (!gradients.height) return false
    if (!gradients.radial) return false
  }
  if (vector.type === 'posters') return true
  return false
}

export const is_rect = rect => {
  if (rect === null || rect === undefined) return true
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
export { set_vector_dimensions } from '@/utils/vector-dimensions'
