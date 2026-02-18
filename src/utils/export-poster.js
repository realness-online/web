/** @typedef {import('@/types').Id} Id */

import { as_created_at, load } from '@/utils/itemid'
import { as_day_and_time_for_filename } from '@/utils/date'
import { hsl_to_hex } from '@/utils/color-converters'
import { hsla_to_color } from '@/utils/colors'

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
    const hsla = element.getAttribute('stop-color')
    const c = hsla_to_color(hsla)
    element.setAttribute('stop-color', hsl_to_hex(c.h, c.s, c.l))
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

  const figure = svg_element.closest('figure.poster')
  if (figure) {
    const hidden_svg = figure.querySelector('svg[style*="display: none"]')
    if (hidden_svg) {
      const symbols = hidden_svg.querySelectorAll('symbol')
      let defs = svg_clone.querySelector('defs')
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
        svg_clone.appendChild(defs)
      }
      symbols.forEach(symbol => {
        const symbol_id = symbol.getAttribute('id')
        if (symbol_id && referenced_ids.has(symbol_id)) {
          const symbol_clone = /** @type {SVGSymbolElement} */ (
            symbol.cloneNode(true)
          )
          defs.appendChild(symbol_clone)
        }
      })
    }
  }

  const hidden_elements = svg_clone.querySelectorAll(
    '[style*="visibility: hidden"]'
  )
  hidden_elements.forEach(el => {
    el.remove()
  })

  const style_elements = svg_clone.querySelectorAll('[style]')
  style_elements.forEach(el => {
    el.removeAttribute('style')
  })

  const vue_components = svg_clone.querySelectorAll('as-animation')
  vue_components.forEach(component => component.remove())

  svg_clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  normalize_ids_for_download(svg_clone)

  if (localStorage.adobe) adobe(svg_clone)

  return svg_clone
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
  const time = as_day_and_time_for_filename(created)
  const facts = `${time}_${created}.${ext}`
  if (creator?.name) {
    const safe_name = creator.name.replace(/\s+/g, '_')
    return `${safe_name}_${facts}`
  }
  return facts
}
