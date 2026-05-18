import * as THREE from 'three'

/**
 * Rasterizes a self-contained SVG string into a CanvasTexture so gradients,
 * filters, and partial transparency render correctly in WebGL.
 *
 * @param {string} svg_text
 * @param {{ pixel_density?: number }} [options]
 * @returns {Promise<{ texture: THREE.CanvasTexture, width: number, height: number }>}
 */
export const svg_to_canvas_texture = (svg_text, options = {}) => {
  const { pixel_density = 2 } = options
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg_text], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      const w = Math.max(1, Math.round(image.naturalWidth * pixel_density))
      const h = Math.max(1, Math.round(image.naturalHeight * pixel_density))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d canvas context unavailable')
      ctx.drawImage(image, 0, 0, w, h)
      URL.revokeObjectURL(url)

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
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
