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
 * A layer file is a `<symbol>` wrapper around its paths. Storage holds some
 * that wrap nothing — `save_poster` used to persist the empty shell `as-symbol`
 * renders before content arrives. Treating those as present makes
 * `wait_for_poster_symbols` block on a symbol that never fills, so the test
 * here is the one that waiter uses: does the symbol contain anything.
 * @param {string | null | undefined} html
 * @returns {boolean}
 */
export const layer_html_has_content = html => {
  if (typeof html !== 'string') return false
  const inner = html.match(/<symbol[^>]*>([\s\S]*)<\/symbol>/)
  if (!inner) return Boolean(html.trim())
  return Boolean(inner[1].trim())
}

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
