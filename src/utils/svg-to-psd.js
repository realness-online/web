/** @typedef {import('@/types').Id} Id */
import { writePsd } from 'ag-psd'
import { as_layer_id, as_query_id, as_fragment_id } from '@/utils/itemid'

const FOUR_K_WIDTH = 3840

const is_ios = () => {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua)
}

const REDUCED_WIDTH_IOS = 1920

const get_target_width = () => {
  if (is_ios()) return REDUCED_WIDTH_IOS
  return FOUR_K_WIDTH
}

/**
 * Extract core layers (light, regular, medium, bold) from shadows symbol
 * @param {SVGSVGElement} svg_element - The SVG element
 * @param {Id} poster_id - Poster itemid
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Promise<Array<{name: string, imageData: ImageData}>>}
 */
const extract_core_layers = async (svg_element, poster_id, width, height) => {
  const layers = []
  const core_layer_names = ['background', 'light', 'regular', 'medium', 'bold']
  const shadow_layer_id = as_layer_id(poster_id, 'shadows')
  const shadow_fragment = as_fragment_id(shadow_layer_id)

  const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))

  const hidden_elements = svg_clone.querySelectorAll(
    '[style*="visibility: hidden"]'
  )
  hidden_elements.forEach(el => el.remove())

  const vue_components = svg_clone.querySelectorAll('as-animation')
  vue_components.forEach(component => component.remove())

  const lightbar_elements = svg_clone.querySelectorAll(
    '[id^="lightbar"], rect[fill*="lightbar"]'
  )
  lightbar_elements.forEach(el => el.remove())

  const cutout_use_elements = svg_clone.querySelectorAll(
    'use[itemprop="sediment"], use[itemprop="sand"], use[itemprop="gravel"], use[itemprop="rocks"], use[itemprop="boulders"]'
  )
  cutout_use_elements.forEach(el => el.remove())

  svg_clone.setAttribute('width', String(width))
  svg_clone.setAttribute('height', String(height))
  svg_clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const figure = svg_element.closest('figure.poster')
  const cutout_layer_names = ['sediment', 'sand', 'gravel', 'rocks', 'boulders']
  const cutout_symbol_ids = new Set(
    cutout_layer_names.map(layer_name =>
      as_query_id(as_layer_id(poster_id, layer_name))
    )
  )
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
        if (!cutout_symbol_ids.has(symbol_id)) {
          const symbol_clone = symbol.cloneNode(true)
          defs.appendChild(symbol_clone)
        }
      })
    }
  }

  for (const layer_name of core_layer_names) {
    const layer_clone = /** @type {SVGSVGElement} */ (svg_clone.cloneNode(true))

    const use_shadow = layer_clone.querySelector(
      `use[href="${shadow_fragment}"]`
    )
    if (!use_shadow) continue

    const shadow_symbol = layer_clone.querySelector(
      `symbol[id="${as_query_id(shadow_layer_id)}"]`
    )
    if (!shadow_symbol) continue

    const layer_elements = shadow_symbol.querySelectorAll('[itemprop]')
    layer_elements.forEach(el => {
      const itemprop = el.getAttribute('itemprop')
      if (itemprop !== layer_name) el.remove()
    })

    const svg_data = new XMLSerializer().serializeToString(layer_clone)
    const svg_blob = new Blob([svg_data], { type: 'image/svg+xml' })
    const svg_url = URL.createObjectURL(svg_blob)

    const img = new Image()
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = svg_url
    })

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    const image_data = ctx.getImageData(0, 0, width, height)

    URL.revokeObjectURL(svg_url)
    img.src = ''

    layers.push({
      name: layer_name.charAt(0).toUpperCase() + layer_name.slice(1),
      imageData: image_data
    })
  }

  return layers
}

/**
 * Extract cutout layers (sediment, sand, gravel, rocks, boulders)
 * @param {SVGSVGElement} svg_element - The SVG element
 * @param {Id} poster_id - Poster itemid
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Promise<Array<{name: string, imageData: ImageData}>>}
 */
const extract_cutout_layers = async (svg_element, poster_id, width, height) => {
  const layers = []
  const cutout_layer_names = ['sediment', 'sand', 'gravel', 'rocks', 'boulders']

  const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))

  const hidden_elements = svg_clone.querySelectorAll(
    '[style*="visibility: hidden"]'
  )
  hidden_elements.forEach(el => el.remove())

  const vue_components = svg_clone.querySelectorAll('as-animation')
  vue_components.forEach(component => component.remove())

  const lightbar_elements = svg_clone.querySelectorAll(
    '[id^="lightbar"], rect[fill*="lightbar"]'
  )
  lightbar_elements.forEach(el => el.remove())

  const shadow_use = svg_clone.querySelector('use[itemprop="shadow"]')
  if (shadow_use) shadow_use.remove()

  svg_clone.setAttribute('width', String(width))
  svg_clone.setAttribute('height', String(height))
  svg_clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const figure = svg_element.closest('figure.poster')
  const shadow_layer_id = as_layer_id(poster_id, 'shadows')
  const shadow_symbol_id = as_query_id(shadow_layer_id)
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
        if (symbol_id !== shadow_symbol_id) {
          const symbol_clone = symbol.cloneNode(true)
          defs.appendChild(symbol_clone)
        }
      })
    }
  }

  for (const layer_name of cutout_layer_names) {
    const layer_id = as_layer_id(poster_id, layer_name)
    const layer_fragment = as_fragment_id(layer_id)

    const use_element = svg_clone.querySelector(`use[href="${layer_fragment}"]`)
    if (!use_element) continue

    const layer_clone = /** @type {SVGSVGElement} */ (svg_clone.cloneNode(true))
    const all_uses = layer_clone.querySelectorAll('use')
    all_uses.forEach(use => {
      const href = use.getAttribute('href')
      if (href !== layer_fragment) use.remove()
    })

    const svg_data = new XMLSerializer().serializeToString(layer_clone)
    const svg_blob = new Blob([svg_data], { type: 'image/svg+xml' })
    const svg_url = URL.createObjectURL(svg_blob)

    const img = new Image()
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = svg_url
    })

    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    const image_data = ctx.getImageData(0, 0, width, height)

    URL.revokeObjectURL(svg_url)
    img.src = ''

    layers.push({
      name: layer_name.charAt(0).toUpperCase() + layer_name.slice(1),
      imageData: image_data
    })
  }

  return layers
}

/**
 * Render SVG layers to PSD file
 * @param {SVGSVGElement} svg_element - The SVG element with poster
 * @param {Id} poster_id - Poster itemid
 * @param {number} [target_width] - Target width in pixels (defaults to 4K: 3840)
 * @returns {Promise<Uint8Array>} PSD file as Uint8Array
 */
export const render_svg_layers_to_psd = async (
  svg_element,
  poster_id,
  target_width = null
) => {
  const effective_width = target_width || get_target_width()

  const viewbox = svg_element.viewBox.baseVal
  const aspect_ratio = viewbox.width / viewbox.height
  const width = effective_width
  const height = Math.round(effective_width / aspect_ratio)

  const core_layers = await extract_core_layers(
    svg_element,
    poster_id,
    width,
    height
  )

  const cutout_layers = await extract_cutout_layers(
    svg_element,
    poster_id,
    width,
    height
  )

  if (core_layers.length === 0 && cutout_layers.length === 0) {
    console.error('[PSD Generation] No layers found to export')
    throw new Error('No layers found to export')
  }

  const shadow_group = {
    name: 'Shadows',
    children: core_layers.map(({ name, imageData }) => ({
      name,
      opacity: 1,
      left: 0,
      top: 0,
      imageData
    }))
  }

  const cutout_group = {
    name: 'Mosaic',
    children: cutout_layers.map(({ name, imageData }) => ({
      name,
      opacity: 1,
      left: 0,
      top: 0,
      imageData
    }))
  }

  const psd = {
    width,
    height,
    children: [shadow_group, cutout_group]
  }

  /** @type {ArrayBuffer} */
  const buffer = writePsd(psd)

  const uint8_array = new Uint8Array(buffer)

  return uint8_array
}

/**
 * Extract all layers (core + cutout) for export
 * @param {SVGSVGElement} svg_element - The SVG element with poster
 * @param {Id} poster_id - Poster itemid
 * @param {number} [target_width] - Target width in pixels (defaults to 4K: 3840)
 * @returns {Promise<Array<{name: string, imageData: ImageData}>>}
 */
export const extract_all_layers = async (
  svg_element,
  poster_id,
  target_width = FOUR_K_WIDTH
) => {
  const viewbox = svg_element.viewBox.baseVal
  const aspect_ratio = viewbox.width / viewbox.height
  const width = target_width
  const height = Math.round(target_width / aspect_ratio)

  const core_layers = await extract_core_layers(
    svg_element,
    poster_id,
    width,
    height
  )

  const cutout_layers = await extract_cutout_layers(
    svg_element,
    poster_id,
    width,
    height
  )

  return [...core_layers, ...cutout_layers]
}
