/** @typedef {import('@/types').Id} Id */

import { get, set, keys, del } from 'idb-keyval'
import { as_created_at, as_author, load } from '@/utils/itemid'
import { mutex_for } from '@/utils/algorithms'
import { is_sync_index_missing } from '@/utils/sync-file'
import { as_day_time_of_day_for_filename } from '@/utils/date'
import {
  hsl_to_hex,
  oklch_to_hex,
  parse_css_oklch_string
} from '@/utils/color-converters'
import { css_color_to_color } from '@/utils/colors'
import { merge_poster_hidden_symbols } from '@/utils/poster-canvas'
import { as_layer_id } from '@/utils/itemid'
import { geology_layers } from '@/use/poster'
import { find_geology_symbol, load_cutout_flags } from '@/utils/geology'
import {
  mosaic,
  boulders,
  rocks,
  gravel,
  sand,
  sediment
} from '@/utils/preference'

const normalize_ids_for_download = svg => {
  const id_map = new Map()

  const all_elements = svg.querySelectorAll('[id]')
  all_elements.forEach(el => {
    const old_id = el.getAttribute('id')
    if (!old_id) return

    const itemprop = el.getAttribute('itemprop')
    let new_id = null

    if (itemprop) {
      const layer_names = [
        'light',
        'regular',
        'medium',
        'bold',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders',
        'shadow',
        'background'
      ]
      if (layer_names.includes(itemprop)) new_id = itemprop
    }

    if (!new_id) {
      const itemid = el.getAttribute('itemid')
      if (itemid) {
        const parts = itemid.split('/')
        if (parts.length >= 3) {
          const [, , layer_type] = parts
          const layer_names = [
            'shadows',
            'sediment',
            'sand',
            'gravel',
            'rocks',
            'boulders'
          ]
          if (layer_names.includes(layer_type))
            new_id = layer_type === 'shadows' ? 'shadows' : layer_type
        }
      }
    }

    if (new_id && new_id !== old_id) {
      id_map.set(old_id, new_id)
      el.setAttribute('id', new_id)
    }
  })

  const href_elements = svg.querySelectorAll('[href]')
  href_elements.forEach(el => {
    const href = el.getAttribute('href')
    if (href && href.startsWith('#')) {
      const old_id = href.substring(1)
      const new_id = id_map.get(old_id)
      if (new_id) el.setAttribute('href', `#${new_id}`)
    }
  })

  const url_attrs = ['fill', 'stroke', 'mask']
  url_attrs.forEach(attr => {
    const elements = svg.querySelectorAll(`[${attr}]`)
    elements.forEach(el => {
      const value = el.getAttribute(attr)
      if (value && value.includes('url(#')) {
        const match = value.match(/url\(#([^)]+)\)/)
        if (match) {
          const [, old_id] = match
          const new_id = id_map.get(old_id)
          if (new_id)
            el.setAttribute(
              attr,
              value.replace(`url(#${old_id})`, `url(#${new_id})`)
            )
        }
      }
    })
  })
}

const adobe = svg => {
  const convert = svg.querySelectorAll('[stop-color]')
  convert.forEach(element => {
    const css_color = element.getAttribute('stop-color')
    const oklch = parse_css_oklch_string(css_color)
    if (oklch)
      element.setAttribute(
        'stop-color',
        oklch_to_hex(oklch.l, oklch.c, oklch.h)
      )
    else {
      const c = css_color_to_color(css_color)
      element.setAttribute('stop-color', hsl_to_hex(c.h, c.s, c.l))
    }
  })
}

/**
 * @param {SVGSVGElement} svg_element
 * @returns {SVGSVGElement}
 */
export const build_download_svg = svg_element => {
  const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))

  const use_elements = svg_clone.querySelectorAll('use[href]')
  const referenced_ids = new Set()
  use_elements.forEach(use_el => {
    const href = use_el.getAttribute('href')
    if (href && href.startsWith('#')) referenced_ids.add(href.substring(1))
  })

  merge_poster_hidden_symbols(
    svg_clone,
    svg_element,
    symbol_id => !!(symbol_id && referenced_ids.has(symbol_id))
  )

  const hidden_elements = svg_clone.querySelectorAll(
    '[style*="visibility: hidden"]'
  )
  hidden_elements.forEach(el => {
    el.remove()
  })

  // Keep inline presentation styles (e.g. mosaic opacity) so exported SVG
  // matches on-screen layer blending in third-party apps.

  const vue_components = svg_clone.querySelectorAll('as-animation')
  vue_components.forEach(component => component.remove())

  svg_clone.querySelectorAll('g[data-grid-overlay]').forEach(el => el.remove())

  svg_clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  normalize_ids_for_download(svg_clone)

  if (localStorage.adobe) adobe(svg_clone)

  return svg_clone
}

const SYMBOL_WAIT_TIMEOUT_MS = 15000

const cutout_layer_prefs = { boulders, rocks, gravel, sand, sediment }

/**
 * Drop stale "missing on server" rows for a poster and its layer files so the
 * next loads re-verify against Storage. A 404 seen once (mid-upload from
 * another device, or a mis-resolved archive path) otherwise blocks every
 * fetch of that file until the periodic purge.
 * @param {Id} itemid
 * @returns {Promise<void>}
 */
export const revalidate_poster_files = async itemid => {
  const ids = [
    itemid,
    as_layer_id(itemid, 'shadows'),
    ...geology_layers.map(layer => as_layer_id(itemid, layer))
  ]
  const mutex = mutex_for('sync:index')
  await mutex.lock()
  try {
    const index = (await get('sync:index')) || {}
    const stale = ids.filter(id => is_sync_index_missing(index[id]))
    if (!stale.length) return
    for (const id of stale) delete index[id]
    await set('sync:index', index)
    console.info('[export-poster] revalidating server files', itemid, stale)
    // Negative rows usually come from a mis-resolved archive path. Drop the
    // cached poster directory listings and archive map too, so the next load
    // re-resolves against the server instead of the same stale cache.
    const author = as_author(itemid)
    if (author) {
      const prefix = `${author}/posters/`
      const everything = (await keys()) ?? []
      const dirs = everything.filter(
        key =>
          typeof key === 'string' && key.startsWith(prefix) && key.endsWith('/')
      )
      await Promise.all(dirs.map(key => del(key)))
    }
  } finally {
    mutex.unlock()
  }
}

/**
 * Resolve once `ready()` is true, re-checking only when `root`'s subtree
 * mutates. Event-driven — no animation-frame polling, so it settles (or times
 * out) even in a backgrounded tab.
 * @param {Node} root
 * @param {() => boolean} ready
 * @param {number} [timeout_ms]
 * @returns {Promise<void>}
 */
const when_mutated = (root, ready, timeout_ms = SYMBOL_WAIT_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    if (ready()) {
      resolve(undefined)
      return
    }
    const observer = new MutationObserver(() => {
      if (!ready()) return
      observer.disconnect()
      clearTimeout(timer)
      resolve(undefined)
    })
    const timer = setTimeout(() => {
      observer.disconnect()
      reject(new Error('Timeout waiting for poster symbol'))
    }, timeout_ms)
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    })
  })

/**
 * @param {Element} symbol_el
 * @returns {Promise<void>}
 */
const symbol_has_content = symbol_el =>
  when_mutated(symbol_el, () => Boolean(symbol_el.innerHTML.trim()))

/**
 * @param {Element} symbol_el
 * @returns {Promise<void>}
 */
const wait_for_shadow_background = symbol_el =>
  when_mutated(symbol_el, () => {
    const background = symbol_el.querySelector('[itemprop="background"]')
    return Boolean(background?.getAttribute('fill')?.trim())
  })

/**
 * @param {Element} symbol_defs
 * @param {Id} itemid
 * @param {string} layer
 * @returns {Promise<void>}
 */
const wait_for_geology_symbol = (symbol_defs, itemid, layer) =>
  when_mutated(symbol_defs, () => {
    const symbol = find_geology_symbol(symbol_defs, itemid, layer)
    return Boolean(symbol && symbol.innerHTML.trim())
  })

/**
 * @param {Element} symbol_defs
 * @param {Id} itemid
 * @returns {Promise<void>}
 */
const wait_for_poster_symbols = async (symbol_defs, itemid) => {
  /** @type {Record<string, boolean>} */
  let flags = {}
  try {
    flags = await load_cutout_flags(itemid)
  } catch {
    // Flags unavailable — fall back to waiting on already-mounted symbols
  }
  const waits = geology_layers
    .map(layer => {
      // Cutout symbols mount only after the poster's cutout flags load — an
      // expected symbol may not be in the DOM yet, so wait for it to appear.
      const expected =
        mosaic.value && cutout_layer_prefs[layer].value && flags[layer]
      if (expected) return wait_for_geology_symbol(symbol_defs, itemid, layer)
      const symbol = find_geology_symbol(symbol_defs, itemid, layer)
      return symbol ? symbol_has_content(symbol) : null
    })
    .filter(Boolean)

  const shadow_id = as_layer_id(itemid, 'shadows')
  const shadow_symbol = symbol_defs.querySelector(
    `symbol[itemid="${shadow_id}"]`
  )
  if (shadow_symbol) waits.push(wait_for_shadow_background(shadow_symbol))

  await Promise.all(waits)
}

/**
 * @param {SVGSVGElement} svg_el
 * @returns {Element | null | undefined}
 */
const find_symbol_defs = svg_el =>
  svg_el
    .closest('figure:has([itemtype="/posters"])')
    ?.querySelector('svg[data-poster-symbol-defs]')

/**
 * Waits for the poster's companion symbol defs (cutouts, shadow background)
 * to have content so `build_download_svg` merges filled symbols, not empty ones.
 * Resolves immediately when the poster has no companion defs.
 *
 * @param {SVGSVGElement} svg_el
 * @param {Id} itemid
 * @returns {Promise<void>}
 */
export const wait_for_poster_export_ready = async (svg_el, itemid) => {
  const symbol_defs = find_symbol_defs(svg_el)
  if (symbol_defs) await wait_for_poster_symbols(symbol_defs, itemid)
}

/**
 * Builds a standalone SVG string for 3D (viewer or GLB export), including
 * geology cutout symbols from the live poster DOM.
 *
 * @param {SVGSVGElement} svg_el
 * @param {Id} itemid
 * @param {{ wait_for_symbols?: boolean }} [options]
 * @returns {Promise<string>}
 */
export const prepare_poster_svg_for_3d = async (
  svg_el,
  itemid,
  { wait_for_symbols = true } = {}
) => {
  const symbol_defs = find_symbol_defs(svg_el)

  if (wait_for_symbols && symbol_defs)
    await wait_for_poster_symbols(symbol_defs, itemid)

  const prepared = build_download_svg(svg_el)
  const defs = prepared.querySelector('defs')
  if (!defs) return new XMLSerializer().serializeToString(prepared)

  if (!symbol_defs) return new XMLSerializer().serializeToString(prepared)

  for (const layer of geology_layers) {
    const symbol = find_geology_symbol(symbol_defs, itemid, layer)
    if (!symbol) continue
    const symbol_clone = /** @type {Element} */ (symbol.cloneNode(true))
    symbol_clone.setAttribute('id', layer)
    defs.appendChild(symbol_clone)
  }

  return new XMLSerializer().serializeToString(prepared)
}

/**
 * @param {Id} itemid
 * @param {string} ext
 * @returns {Promise<string>}
 */
export const get_filename_for_poster = async (itemid, ext) => {
  const created = as_created_at(itemid)
  if (!created) return `poster.${ext}`
  const path = itemid.split('/')
  const author_id = path[1] ? `/${path[1]}` : ''
  const creator = author_id
    ? /** @type {import('@/types').Person | null} */ (
        /** @type {unknown} */ (await load(/** @type {Id} */ (author_id)))
      )
    : null
  const date_part = as_day_time_of_day_for_filename(created)
  const facts = `${date_part} - ${created}.${ext}`
  if (creator?.name) return `${creator.name} @ ${facts}`
  return facts
}
