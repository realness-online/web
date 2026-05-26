import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * @typedef {Object} PosterSvgContext
 * @property {Document} doc
 * @property {Element} root
 * @property {number[]} view_box
 * @property {string} defs_html
 */

/**
 * @param {string} svg_text
 * @returns {PosterSvgContext}
 */
export const parse_poster_svg = svg_text => {
  const doc = new DOMParser().parseFromString(svg_text, 'image/svg+xml')
  const root = doc.documentElement
  const view_box = (root.getAttribute('viewBox') || '0 0 1 1')
    .split(/\s+/)
    .map(Number)
  const defs = root.querySelector(':scope > defs')

  return {
    doc,
    root,
    view_box,
    defs_html: defs ? defs.outerHTML : ''
  }
}

/**
 * Parses mosaic symbols from an existing poster SVG context.
 *
 * @param {PosterSvgContext} poster_svg
 * @param {string[]} layer_names
 * @returns {{
 *   width: number,
 *   height: number,
 *   layers: { name: string, paths: import('three').ShapePath[] }[]
 * }}
 */
export const parse_svg_layers_from_context = (poster_svg, layer_names) => {
  const { root, view_box } = poster_svg
  const [, , width, height] = view_box

  const loader = new SVGLoader()
  const layers = []

  for (const name of layer_names) {
    const symbol = root.querySelector(`symbol#${name}`)
    if (!symbol) continue

    const sub_svg = `<svg xmlns="${SVG_NS}" viewBox="0 0 ${width} ${height}">${symbol.innerHTML}</svg>`
    const data = loader.parse(sub_svg)
    layers.push({ name, paths: data.paths })
  }

  return { width, height, layers }
}

/**
 * @param {string} svg_text
 * @param {string[]} layer_names
 */
export const parse_svg_layers = (svg_text, layer_names) =>
  parse_svg_layers_from_context(parse_poster_svg(svg_text), layer_names)

/**
 * Returns a standalone SVG document containing only the named layer,
 * preserving all <defs> so gradients and filters still resolve.
 *
 * @param {string} svg_text
 * @param {string} layer_name
 * @returns {string}
 */
export const extract_layer_svg = (svg_text, layer_name) => {
  const { doc, root, view_box } = parse_poster_svg(svg_text)

  root.setAttribute('width', String(view_box[2]))
  root.setAttribute('height', String(view_box[3]))

  for (const child of root.querySelectorAll(':scope > *:not(defs)'))
    child.remove()

  const use = doc.createElementNS(SVG_NS, 'use')
  use.setAttribute('href', `#${layer_name}`)
  root.appendChild(use)

  return new XMLSerializer().serializeToString(doc)
}

/**
 * @param {PosterSvgContext} poster_svg
 * @param {string} symbol_id
 * @param {string} child_id
 * @returns {string | null}
 */
export const extract_symbol_child_from_context = (
  poster_svg,
  symbol_id,
  child_id
) => {
  const { root, view_box, defs_html } = poster_svg
  const symbol = root.querySelector(`symbol#${symbol_id}`)
  if (!symbol) return null
  const child = symbol.querySelector(`#${child_id}`)
  if (!child) return null

  return (
    `<svg xmlns="${SVG_NS}" viewBox="${view_box.join(' ')}"` +
    ` width="${view_box[2]}" height="${view_box[3]}">${defs_html}${child.outerHTML}</svg>`
  )
}

/**
 * @param {string | null} svg_text
 * @param {'fill' | 'stroke'} mode
 */
const prepare_raster_svg = (svg_text, mode) => {
  if (!svg_text) return null

  const doc = new DOMParser().parseFromString(svg_text, 'image/svg+xml')
  doc.querySelectorAll('path').forEach(path => {
    if (mode === 'fill') {
      path.setAttribute('stroke', 'none')
      path.setAttribute('stroke-opacity', '0')
      path.setAttribute('stroke-width', '0')
      path.removeAttribute('stroke-dasharray')
      path.removeAttribute('stroke-dashoffset')
      return
    }

    path.setAttribute('fill', 'none')
    path.removeAttribute('fill-opacity')
    path.removeAttribute('fill-rule')
    if (path.getAttribute('stroke') === 'none') return
    path.setAttribute('stroke-opacity', '0.90')
  })

  return new XMLSerializer().serializeToString(doc.documentElement)
}

/**
 * @param {PosterSvgContext} poster_svg
 * @param {string} symbol_id
 * @param {string} child_id
 */
export const extract_symbol_child_fill_from_context = (
  poster_svg,
  symbol_id,
  child_id
) =>
  prepare_raster_svg(
    extract_symbol_child_from_context(poster_svg, symbol_id, child_id),
    'fill'
  )

/**
 * @param {PosterSvgContext} poster_svg
 * @param {string} symbol_id
 * @param {string} child_id
 */
export const extract_symbol_child_stroke_from_context = (
  poster_svg,
  symbol_id,
  child_id
) =>
  prepare_raster_svg(
    extract_symbol_child_from_context(poster_svg, symbol_id, child_id),
    'stroke'
  )

/**
 * Returns a standalone SVG document containing only one child element
 * (by id) inside a named symbol, with all <defs> intact.
 *
 * @param {string} svg_text
 * @param {string} symbol_id
 * @param {string} child_id
 * @returns {string | null}
 */
export const extract_symbol_child_svg = (svg_text, symbol_id, child_id) =>
  extract_symbol_child_from_context(
    parse_poster_svg(svg_text),
    symbol_id,
    child_id
  )
