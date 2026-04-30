/**
 * Copy `<symbol>` nodes from the poster's hidden companion SVG (`data-poster-symbol-defs`)
 * into `svg_clone`'s existing `<defs>` when `include_symbol(id)` is true, so `<use href="#…">`
 * resolves in exports (flat SVG download, PSD raster, canvas raster). No-op if `<defs>` is missing.
 *
 * @param {SVGSVGElement} svg_clone - Working clone (mutated: symbols appended to defs)
 * @param {SVGSVGElement} svg_element - Live poster root (used for `closest('figure.poster')`)
 * @param {(symbol_id: string | null) => boolean} include_symbol
 */
export const merge_poster_hidden_symbols = (
  svg_clone,
  svg_element,
  include_symbol
) => {
  const figure = svg_element.closest('figure.poster')
  if (!figure) return
  const hidden_svg = figure.querySelector('svg[data-poster-symbol-defs]')
  if (!hidden_svg) return
  const symbols = hidden_svg.querySelectorAll('symbol')
  const defs = svg_clone.querySelector('defs')
  if (!defs) return
  symbols.forEach(symbol => {
    const symbol_id = symbol.getAttribute('id')
    if (include_symbol(symbol_id)) defs.appendChild(symbol.cloneNode(true))
  })
}

/**
 * Rasterize a poster SVG (with the same prep as full-size export) to a canvas.
 * @param {SVGSVGElement} svg_element
 * @param {number} width
 * @param {number} height
 * @returns {Promise<OffscreenCanvas>}
 */
export const render_complete_poster_to_canvas = async (
  svg_element,
  width,
  height
) => {
  const svg_clone = /** @type {SVGSVGElement} */ (svg_element.cloneNode(true))

  const hidden_elements = svg_clone.querySelectorAll(
    '[style*="visibility: hidden"]'
  )
  hidden_elements.forEach(el => el.remove())

  const vue_components = svg_clone.querySelectorAll('as-animation')
  vue_components.forEach(component => component.remove())

  svg_clone.setAttribute('width', String(width))
  svg_clone.setAttribute('height', String(height))
  svg_clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  merge_poster_hidden_symbols(svg_clone, svg_element, () => true)

  const svg_data = new XMLSerializer().serializeToString(svg_clone)
  const svg_blob = new Blob([svg_data], { type: 'image/svg+xml' })
  const svg_url = URL.createObjectURL(svg_blob)

  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = svg_url
  })

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('render poster: 2d canvas context unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(svg_url)

  return canvas
}
