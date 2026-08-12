import * as THREE from 'three'
import { probe_html_in_canvas } from '@/3d/utils/html-in-canvas.js'

const CAPTURE_DEFAULT_SIZE = 512
const FRONT_SHADOW_MESH = 'shadow-bold'
/** RGBA bytes per pixel in a readPixels/ImageData buffer */
const BYTES_PER_PIXEL = 4

/**
 * Captures a live DOM element into a 2D canvas on every browser paint, using
 * the HTML-in-Canvas origin trial. A THREE.CanvasTexture over that canvas then
 * shows the poster's running morph (and its gyro nudge) inside the 3D viewer.
 *
 * Entirely inert unless the probe passes - Chrome Canary behind
 * `#canvas-draw-element` or an origin-trial token. Anywhere else this returns
 * `null` and the caller keeps its baked texture.
 *
 * The offscreen WebGL canvas carries `layoutsubtree` and sits off-screen but
 * laid out (not display:none, which would skip the element's paint), so the
 * browser paints the captured element into it.
 *
 * @param {{ element: Element }} options
 * @returns {{ canvas: HTMLCanvasElement, on_update: () => void, start: () => void, stop: () => void, resize: (w: number, h: number) => void } | null}
 */
export const create_live_texture_capture = ({ element }) => {
  if (!probe_html_in_canvas()) return null

  const gl = document.createElement('canvas').getContext('webgl')
  if (!gl) return null

  const capture =
    /** @type {HTMLCanvasElement & { onpaint: ((ev: Event) => void) | null }} */ (
      document.createElement('canvas')
    )
  capture.setAttribute('layoutsubtree', '')
  const gl2 =
    /** @type {WebGLRenderingContext & { texElementImage2D?: Function }} */ (gl)
  const texture = gl.createTexture()
  const framebuffer = gl.createFramebuffer()
  const output = document.createElement('canvas')
  const out_ctx = /** @type {CanvasRenderingContext2D} */ (
    output.getContext('2d')
  )

  let width = CAPTURE_DEFAULT_SIZE
  let height = CAPTURE_DEFAULT_SIZE
  let pixels = new Uint8Array(
    CAPTURE_DEFAULT_SIZE * CAPTURE_DEFAULT_SIZE * BYTES_PER_PIXEL
  )
  /** @type {ImageData | null} */
  let image_data = null
  /** @type {(() => void) | null} */
  let on_update = null

  const place_capture = () => {
    capture.style.position = 'absolute'
    capture.style.left = '-9999px'
    capture.style.top = '0'
    capture.style.width = `${width}px`
    capture.style.height = `${height}px`
    document.body.append(capture)
  }

  const allocate = () => {
    capture.width = width
    capture.height = height
    output.width = width
    output.height = height
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    )
    pixels = new Uint8Array(width * height * BYTES_PER_PIXEL)
    image_data = new ImageData(new Uint8ClampedArray(pixels), width, height)
  }

  const paint = () => {
    if (!gl2.texElementImage2D || !image_data) return
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl2.texElementImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      element
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    // WebGL reads bottom-up; ImageData is top-down, so flip on the way out.
    const row = width * BYTES_PER_PIXEL
    const flipped = new Uint8ClampedArray(pixels.length)
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * row
      flipped.set(pixels.subarray(src, src + row), y * row)
    }
    image_data.data.set(flipped)
    out_ctx.putImageData(image_data, 0, 0)
    on_update?.()
  }

  place_capture()
  allocate()

  return {
    canvas: output,
    set on_update(value) {
      on_update = value
    },
    start() {
      capture.onpaint = paint
    },
    stop() {
      capture.onpaint = null
      capture.remove()
      gl.deleteTexture(texture)
      gl.deleteFramebuffer(framebuffer)
    },
    resize(next_width, next_height) {
      width = Math.max(1, Math.round(next_width))
      height = Math.max(1, Math.round(next_height))
      allocate()
    }
  }
}

/**
 * Swap the front shadow layer's baked texture for a live capture of the
 * poster's own `<svg>` so the running morph shows in 3D. Null when the
 * feature is off (no flag) or the layer is missing - the scene keeps its
 * baked texture.
 * @param {{ element: Element, scene: THREE.Scene }} options
 * @returns {(() => void) | null} Cleanup: stop capture + dispose the texture.
 */
export const attach_live_poster_texture = ({ element, scene }) => {
  const mesh = scene.getObjectByName(FRONT_SHADOW_MESH)
  const material = mesh?.material
  if (!mesh || !material || !material.isMeshBasicMaterial) return null

  const capture = create_live_texture_capture({ element })
  if (!capture) return null

  const texture = new THREE.CanvasTexture(capture.canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  capture.on_update = () => {
    texture.needsUpdate = true
  }
  material.map = texture
  material.needsUpdate = true
  const rect = element.getBoundingClientRect()
  if (rect.width && rect.height) capture.resize(rect.width, rect.height)
  capture.start()

  return () => {
    capture.stop()
    texture.dispose()
    material.map = null
    material.needsUpdate = true
  }
}
