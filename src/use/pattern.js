/** @typedef {import('@/types').Poster} Poster */
/** @typedef {import('@/types').Id} Id */

import { computed, watchEffect as watch } from 'vue'
import { as_query_id, as_fragment_id } from '@/utils/itemid'
import { use as use_poster } from '@/use/poster'
import { background, light, regular, medium, bold } from '@/utils/preference'

/**
 * @returns {Object}
 */
export const use = () => {
  const { vector, aspect_ratio, tabindex, itemid, viewbox, show } = use_poster()

  const query = add => {
    if (!itemid.value) return add || ''
    if (add) return `${as_query_id(/** @type {Id} */ (itemid.value))}-${add}`
    return as_query_id(/** @type {Id} */ (itemid.value))
  }

  const fragment = add => {
    if (!itemid.value) return add || ''
    if (add) return `${as_fragment_id(/** @type {Id} */ (itemid.value))}-${add}`
    return as_fragment_id(/** @type {Id} */ (itemid.value))
  }

  const width = computed(() => vector.value?.width || 0)
  const height = computed(() => vector.value?.height || 0)

  const background_visible = computed(() => background.value)
  const light_visible = computed(() => vector.value?.light && light.value)
  const regular_visible = computed(() => vector.value?.regular && regular.value)
  const medium_visible = computed(() => vector.value?.medium && medium.value)
  const bold_visible = computed(() => vector.value?.bold && bold.value)

  watch(() => {
    if (!vector.value && itemid.value) show()
  })

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
