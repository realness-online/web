/** @typedef {import('@/types').Id} Id */

import { as_layer_id } from '@/utils/itemid'
import { geology_layers } from '@/use/poster'

/**
 * Split posters reference shadows and cutouts via external layer files.
 * @param {string | null | undefined} html
 * @returns {boolean}
 */
export const is_split_poster_html = html =>
  typeof html === 'string' && /itemprop=["']shadow["']/.test(html)

/**
 * Inline posters embed shadow paths in the main poster file.
 * @param {string | null | undefined} html
 * @returns {boolean}
 */
export const is_inline_poster_html = html =>
  typeof html === 'string' && !is_split_poster_html(html)

/**
 * @param {string} html
 * @param {Id} itemid
 * @returns {Record<string, boolean>}
 */
export const cutout_flags_from_html = (html, itemid) => {
  /** @type {Record<string, boolean>} */
  const cutouts = {}
  for (const layer of geology_layers) {
    const layer_id = as_layer_id(itemid, layer)
    if (html.includes(layer_id)) cutouts[layer] = true
  }
  return cutouts
}
