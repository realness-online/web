/** @typedef {import('@/types').Id} Id */
/** @typedef {import('@/types').Poster} Poster */

import { get } from 'idb-keyval'
import { as_layer_id, load_from_cache, as_created_at } from '@/utils/itemid'
import get_item from '@/utils/item'
import { is_inline_poster_html } from '@/utils/poster-format'

// Last timestamp for old-style (non-split) posters
const GEOLOGY_DATE = 1767138344991

/**
 * @param {Poster} vector
 * @param {Poster} pattern
 * @returns {Poster}
 */
export const apply_poster_shadow_paths = (vector, pattern) => {
  if (pattern.light) vector.light = pattern.light
  if (pattern.regular) vector.regular = pattern.regular
  if (pattern.medium) vector.medium = pattern.medium
  if (pattern.bold) vector.bold = pattern.bold
  if (pattern.background) vector.background = pattern.background
  return vector
}

/**
 * @param {string | null | undefined} html
 * @param {Id} poster_id
 * @returns {Poster | null}
 */
const poster_item_from_html = (html, poster_id) => {
  if (!html) return null
  return /** @type {Poster | null} */ (get_item(html, poster_id))
}

/**
 * Fill shadow paths from a split shadows file or an inline single-file poster.
 * @param {Poster} vector
 * @param {Id} poster_id
 * @returns {Promise<Poster>}
 */
export const load_shadow_into_vector = async (vector, poster_id) => {
  if (vector.regular) return vector

  const created = as_created_at(poster_id)
  // Old-style posters don't have split shadow layers; shadows are inline
  if (created && created <= GEOLOGY_DATE) {
    console.info(
      `[poster-layers] Old-style poster found: ${poster_id} (created: ${created}, geology_date: ${GEOLOGY_DATE})`
    )
    let poster_html = await get(poster_id)
    if (!poster_html) {
      const { html } = await load_from_cache(poster_id)
      if (html) poster_html = html
    }
    if (is_inline_poster_html(poster_html)) {
      const inline_item = poster_item_from_html(poster_html, poster_id)
      if (inline_item) return apply_poster_shadow_paths(vector, inline_item)
    }
    return vector
  }

  const shadow_id = as_layer_id(poster_id, 'shadows')
  let shadow_html = await get(shadow_id)
  if (!shadow_html) {
    const { item, html } = await load_from_cache(shadow_id)
    if (item)
      return apply_poster_shadow_paths(vector, /** @type {Poster} */ (item))
    if (html) shadow_html = html
  }
  const shadow_item = poster_item_from_html(shadow_html, shadow_id)
  if (shadow_item) return apply_poster_shadow_paths(vector, shadow_item)

  let poster_html = await get(poster_id)
  if (!poster_html) {
    const { html } = await load_from_cache(poster_id)
    if (html) poster_html = html
  }
  if (is_inline_poster_html(poster_html)) {
    const inline_item = poster_item_from_html(poster_html, poster_id)
    if (inline_item) return apply_poster_shadow_paths(vector, inline_item)
  }

  return vector
}
