/** @typedef {import('@/types').Id} Id */

import { get } from 'idb-keyval'
import { as_layer_id, load_from_cache, as_created_at } from '@/utils/itemid'
import { geology_layers } from '@/use/poster'
import {
  cutout_flags_from_html,
  is_inline_poster_html
} from '@/utils/poster-format'

// Last timestamp for old-style (non-split) posters
export const GEOLOGY_DATE = 1767138344991

/**
 * @param {ParentNode} symbol_defs
 * @param {Id} itemid
 * @param {string} layer
 * @returns {Element | null}
 */
export const find_geology_symbol = (symbol_defs, itemid, layer) => {
  const layer_id = as_layer_id(itemid, layer)
  return symbol_defs.querySelector(`symbol[itemid="${layer_id}"]`)
}

/**
 * @param {ParentNode | null | undefined} symbol_defs
 * @param {Id} itemid
 * @returns {{ key: string, d: string, transform?: string }[]}
 */
export const collect_geology_paths = (symbol_defs, itemid) => {
  if (!symbol_defs) return []
  const data = []
  for (const layer of geology_layers) {
    const symbol = find_geology_symbol(symbol_defs, itemid, layer)
    if (!symbol) continue
    const paths = symbol.querySelectorAll('path')
    paths.forEach((path, i) => {
      const d = path.getAttribute('d')
      if (!d) return
      data.push({
        key: `${layer}:${i}`,
        d,
        transform: path.getAttribute('transform') || undefined
      })
    })
  }
  return data
}

/**
 * @param {Id} itemid
 * @returns {Promise<Record<string, boolean>>}
 */
export const load_cutout_flags = async itemid => {
  const created = as_created_at(itemid)
  // Old-style posters don't have split geology layers
  if (created && created <= GEOLOGY_DATE) {
    console.info(
      `[geology] Old-style poster found: ${itemid} (created: ${created}, geology_date: ${GEOLOGY_DATE})`
    )
    return {}
  }

  let poster_html = await get(itemid)
  if (!poster_html) {
    const { html } = await load_from_cache(itemid)
    if (html) poster_html = html
  }
  if (is_inline_poster_html(poster_html))
    return cutout_flags_from_html(poster_html, itemid)

  /** @type {Record<string, boolean>} */
  const cutouts = {}
  await Promise.all(
    geology_layers.map(async layer => {
      const layer_id = as_layer_id(itemid, layer)
      const html_string = await get(layer_id)
      if (html_string) cutouts[layer] = true
      else {
        const { html } = await load_from_cache(layer_id)
        if (html) cutouts[layer] = true
      }
    })
  )
  return cutouts
}
