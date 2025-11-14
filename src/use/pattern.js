/** @typedef {import('@/types').Poster} Poster */
/** @typedef {import('@/types').Id} Id */

import { computed, inject, getCurrentInstance as current_instance } from 'vue'
import { as_query_id, as_fragment_id } from '@/utils/itemid'
import { use as use_poster } from '@/use/poster'
import {
  background,
  light,
  regular,
  medium,
  bold
} from '@/utils/preference'

/**
 * @param {Object} [options]
 * @param {Poster} [options.vector]
 * @param {Id} [options.itemid]
 * @returns {Object}
 */
export const use = (options = {}) => {
  const instance = current_instance()
  const props = instance?.props || {}
  const injected_vector = inject('vector', null)
  const poster_composable = use_poster()

  // Resolve vector: options override > props > injection > use_poster
  const vector = computed(() => {
    if (options.vector) return options.vector
    if (props.vector) return props.vector
    if (injected_vector?.value) return injected_vector.value
    return poster_composable.vector.value
  })

  // Resolve itemid: options override > props > from vector
  const itemid = computed(() => {
    if (options.itemid) return options.itemid
    if (props.itemid) return props.itemid
    if (vector.value?.id) return vector.value.id
    return null
  })

  const query = add => {
    if (!itemid.value) return add || ''
    if (add) return `${as_query_id(itemid.value)}-${add}`
    return as_query_id(itemid.value)
  }

  const fragment = add => {
    if (!itemid.value) return add || ''
    if (add) return `${as_fragment_id(itemid.value)}-${add}`
    return as_fragment_id(itemid.value)
  }

  const width = computed(() => vector.value?.width || 0)
  const height = computed(() => vector.value?.height || 0)

  const viewbox = computed(() => {
    if (vector.value?.viewbox) return vector.value.viewbox
    return '0 0 16 16'
  })

  const aspect_ratio = computed(() => poster_composable.aspect_ratio.value)
  const tabindex = computed(() => poster_composable.tabindex.value)

  const background_visible = computed(() => background.value)
  const light_visible = computed(() => vector.value?.light && light.value)
  const regular_visible = computed(() => vector.value?.regular && regular.value)
  const medium_visible = computed(() => vector.value?.medium && medium.value)
  const bold_visible = computed(() => vector.value?.bold && bold.value)

  return {
    query,
    fragment,
    width,
    height,
    viewbox,
    aspect_ratio,
    tabindex,
    vector,
    background_visible,
    light_visible,
    regular_visible,
    medium_visible,
    bold_visible
  }
}

