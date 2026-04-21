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
        const symbol_clone = symbol.cloneNode(true)
        defs.appendChild(symbol_clone)
      })
    }
  }

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
