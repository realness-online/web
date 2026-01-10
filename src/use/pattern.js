/** @typedef {import('@/types').Poster} Poster */
/** @typedef {import('@/types').Id} Id */

import { computed, inject, ref, watchEffect as watch } from 'vue'
import { as_query_id, as_fragment_id, load, as_layer_id } from '@/utils/itemid'
import { use as use_poster } from '@/use/poster'
import { background, light, regular, medium, bold } from '@/utils/preference'

/**
 * @returns {Object}
 */
export const use = () => {
  const poster_data = use_poster()
  const {
    vector: context_vector,
    aspect_ratio,
    tabindex,
    itemid,
    viewbox,
    show
  } = poster_data || {}
  const new_vector = inject('new_vector', ref(null))
  const vector_from_context = inject('vector', null)

  const loaded_vector = ref(null)

  const active_vector = computed(() => {
    if (vector_from_context?.value) return vector_from_context.value
    if (new_vector.value && !context_vector?.value) return new_vector.value
    if (new_vector.value) return new_vector.value
    return context_vector?.value
  })

  const vector_id = computed(() => active_vector.value?.id)

  watch(() => {
    const id = vector_id.value
    if (id && !loaded_vector.value && !active_vector.value?.regular) {
      const pattern_id = as_layer_id(id, 'shadows')
      Promise.all([load(id), load(pattern_id)]).then(([poster, pattern]) => {
        if (poster) {
          const poster_with_pattern = /** @type {Poster} */ (
            /** @type {unknown} */ (poster)
          )
          if (pattern) {
            const pattern_data = /** @type {Poster} */ (
              /** @type {unknown} */ (pattern)
            )
            poster_with_pattern.light = pattern_data.light
            poster_with_pattern.regular = pattern_data.regular
            poster_with_pattern.medium = pattern_data.medium
            poster_with_pattern.bold = pattern_data.bold
            poster_with_pattern.background = pattern_data.background
          }
          loaded_vector.value = poster_with_pattern
        }
      })
    }
  })

  const final_vector = computed(() => {
    if (loaded_vector.value) return loaded_vector.value
    return active_vector.value
  })

  const query = add => {
    if (!vector_id.value) return add || ''
    if (add) return `${as_query_id(vector_id.value)}-${add}`
    return as_query_id(vector_id.value)
  }

  const fragment = add => {
    if (!vector_id.value) return add || ''
    if (add) return `${as_fragment_id(vector_id.value)}-${add}`
    return as_fragment_id(vector_id.value)
  }

  const width = computed(() => final_vector.value?.width || 0)
  const height = computed(() => final_vector.value?.height || 0)

  const pattern_viewbox = computed(
    () => final_vector.value?.viewbox || viewbox?.value || '0 0 16 16'
  )

  const background_visible = computed(() => background.value)
  const light_visible = computed(() => final_vector.value?.light && light.value)
  const regular_visible = computed(
    () => final_vector.value?.regular && regular.value
  )
  const medium_visible = computed(
    () => final_vector.value?.medium && medium.value
  )
  const bold_visible = computed(() => final_vector.value?.bold && bold.value)

  watch(() => {
    if (!final_vector.value && vector_id.value && show) show()
    else if (!final_vector.value && vector_id.value && !loaded_vector.value)
      load(vector_id.value).then(poster => {
        loaded_vector.value = poster
      })
  })

  return {
    query,
    fragment,
    width,
    height,
    viewbox: pattern_viewbox,
    aspect_ratio: aspect_ratio || computed(() => 'xMidYMid meet'),
    tabindex: tabindex || computed(() => -1),
    vector: final_vector,
    itemid: computed(() => itemid?.value || vector_id.value || ''),
    background_visible,
    light_visible,
    regular_visible,
    medium_visible,
    bold_visible
  }
}
