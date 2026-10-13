import * as THREE from 'three'

/**
 * Density that keeps the longer raster edge within max_dimension. Smooth art
 * like a gradient reads the same at a fraction of the shape's resolution.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} pixel_density
 * @param {number} max_dimension 0 to leave pixel_density alone
 */
const raster_density = (width, height, pixel_density, max_dimension) => {
  const longest = Math.max(width, height) * pixel_density
  if (!max_dimension || longest <= max_dimension) return pixel_density
  return (pixel_density * max_dimension) / longest
}

/**
 * Rasterizes a self-contained SVG string into a CanvasTexture so gradients,
 * filters, and partial transparency render correctly in WebGL.
 *
 * `background` paints the canvas before the SVG lands on it. An alpha map
 * needs that: three.js reads coverage from the green channel, and a shape
 * drawn on a transparent canvas keeps its colour there whatever its alpha.
 *
 * @param {string} svg_text
 * @param {{ pixel_density?: number, max_dimension?: number, background?: string, color_space?: string }} [options]
 * @returns {Promise<{ texture: THREE.CanvasTexture, width: number, height: number }>}
 */
export const svg_to_canvas_texture = (svg_text, options = {}) => {
  const {
    pixel_density = 2,
    max_dimension = 0,
    background = '',
    color_space = THREE.SRGBColorSpace
  } = options
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg_text], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      const density = raster_density(
        image.naturalWidth,
        image.naturalHeight,
        pixel_density,
        max_dimension
      )
      const w = Math.max(1, Math.round(image.naturalWidth * density))
      const h = Math.max(1, Math.round(image.naturalHeight * density))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d canvas context unavailable')
      if (background) {
        ctx.fillStyle = background
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(image, 0, 0, w, h)
      URL.revokeObjectURL(url)

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = color_space
      texture.anisotropy = 4
      resolve({ texture, width: w, height: h })
    }

    image.onerror = error => {
      URL.revokeObjectURL(url)
      reject(
        error instanceof Error ? error : new Error('Failed to load SVG image')
      )
    }

    image.src = url
  })
}
