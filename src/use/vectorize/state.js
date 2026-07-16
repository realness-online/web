import { ref } from 'vue'

/** @typedef {import('@/types').Poster} PosterType */
/** @typedef {import('@/types').Id} Id */

/** Shared pipeline outputs — kept out of vectorize.js so light consumers
 *  (e.g. as-gradients) do not pull the full worker/persistence graph. */

export const new_vector = ref(/** @type {PosterType | null} */ (null))

export const new_gradients = ref(
  /** @type {{horizontal?: string[], vertical?: string[], radial?: string[]} | null} */ (
    null
  )
)

export const progress = ref(0)

export const current_item_id = ref(/** @type {Id | null} */ (null))

export const source_image_url = ref(/** @type {string | null} */ (null))
