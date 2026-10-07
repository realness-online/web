/**
 * Feature probe for the HTML-in-Canvas origin trial (Chrome 148-150 behind
 * `chrome://flags/#canvas-draw-element` or a token). No polyfill exists, so
 * absence of the API is a clean hard off-switch - the 3D viewer keeps its
 * baked textures and this path never runs.
 *
 * The probe needs a live WebGL context because `texElementImage2D` is a method
 * on the context prototype, not something detectable statically. It is cached
 * so probe_html_in_canvas() only creates a throwaway context once.
 */

/** @type {boolean | null} */
let cached_support = null

const PROBE_WIDTH = 1
const PROBE_HEIGHT = 1

/**
 * @param {WebGLRenderingContext | WebGL2RenderingContext | null} gl
 */
const has_tex_element_image_2d = gl => {
  if (!gl) return false
  const ctx =
    /** @type {WebGLRenderingContext & { texElementImage2D?: Function }} */ (gl)
  return typeof ctx.texElementImage2D === 'function'
}

/**
 * True when the live WebGL context can upload a DOM element into a texture.
 * @returns {boolean}
 */
export const probe_html_in_canvas = () => {
  if (cached_support !== null) return cached_support
  if (
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  ) {
    cached_support = false
    return cached_support
  }

  const canvas = document.createElement('canvas')
  canvas.width = PROBE_WIDTH
  canvas.height = PROBE_HEIGHT
  const gl =
    /** @type {WebGLRenderingContext | WebGL2RenderingContext | null} */ (
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    )
  cached_support = has_tex_element_image_2d(gl)
  return cached_support
}

/** Discard the cached probe (tests). */
export const reset_html_in_canvas_probe = () => {
  cached_support = null
}
