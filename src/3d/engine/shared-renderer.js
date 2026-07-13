import * as THREE from 'three'
import { create_loop } from '@/3d/engine/create-loop.js'
import { create_input } from '@/3d/engine/create-input.js'
import {
  CAMERA_DISTANCE,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  MAX_PIXEL_RATIO,
  RENDERER_CLEAR_ALPHA,
  RENDERER_CLEAR_COLOR,
  WIPE_SOFT_EDGE_PX_MAX
} from '@/3d/engine/renderer-config.js'

// One WebGL context for all 3D viewers in the feed.
// Each viewer registers its canvas + scene; the shared loop renders them in
// sequence and blits each result to the viewer's 2D canvas via drawImage.
// preserveDrawingBuffer is required so the blit reads a stable frame.

// Enter: SVG zooms in, canvas wipes left-to-right (phases overlap).
// Leave: wipe out, then SVG zooms back.
const ENTER_ZOOM_S = 0.38
const ENTER_WIPE_DELAY = 0.26 // wipe starts before zoom finishes
const ENTER_WIPE_S = 0.34
const LEAVE_WIPE_S = 0.2
const LEAVE_ZOOM_S = 0.2

const ease_out = t => 1 - (1 - t) ** 3
const ease_in = t => t ** 3
const smoothstep = t => t * t * (3 - 2 * t) // zero slope at 0 and 1, no sudden jolt

/**
 * @param {CanvasRenderingContext2D} ctx2d
 * @param {number} edge_px
 * @param {number} soft_px
 * @param {CanvasGradient | null} cached
 * @param {string} cached_key
 */
const wipe_gradient = (ctx2d, edge_px, soft_px, cached, cached_key) => {
  const key = `${edge_px}|${soft_px}`
  if (cached && cached_key === key) return cached
  const grad = ctx2d.createLinearGradient(edge_px - soft_px, 0, edge_px, 0)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  return grad
}

let renderer = null
let loop = null
const entries = []
const visible = new Set()

const get_renderer = () => {
  if (renderer) return renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  })
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  )
  renderer.setClearColor(RENDERER_CLEAR_COLOR, RENDERER_CLEAR_ALPHA)
  return renderer
}

const ensure_loop = () => {
  if (loop) return
  loop = create_loop({
    tick: frame_state => {
      if (!visible.size) return
      const r = get_renderer()
      const { delta_s } = frame_state
      for (const entry of visible) {
        if (!entry.width || !entry.height) continue

        let { wipe_t } = entry

        if (entry.phase === 'enter') {
          entry.elapsed += delta_s

          const zoom_raw = Math.min(entry.elapsed / ENTER_ZOOM_S, 1)
          entry.on_svg_zoom?.(smoothstep(zoom_raw))

          const wipe_raw =
            Math.max(0, entry.elapsed - ENTER_WIPE_DELAY) / ENTER_WIPE_S
          wipe_t = ease_out(Math.min(wipe_raw, 1))
          entry.wipe_t = wipe_t

          if (entry.elapsed >= ENTER_WIPE_DELAY + ENTER_WIPE_S) {
            entry.phase = 'done'
            entry.wipe_t = 1
            wipe_t = 1
          }
        } else if (entry.phase === 'leave') {
          entry.elapsed += delta_s

          const wipe_raw = 1 - Math.min(entry.elapsed / LEAVE_WIPE_S, 1)
          wipe_t = ease_in(Math.max(wipe_raw, 0))
          entry.wipe_t = wipe_t

          const zoom_raw =
            Math.max(0, entry.elapsed - LEAVE_WIPE_S) / LEAVE_ZOOM_S
          entry.on_svg_zoom?.(1 - ease_out(Math.min(zoom_raw, 1)))

          if (entry.elapsed >= LEAVE_WIPE_S + LEAVE_ZOOM_S) {
            const done = entry.on_leave_done
            entry.on_leave_done = null
            entry.on_svg_zoom = null
            done?.()
            continue
          }
        }

        if (
          entry.render_width !== entry.width ||
          entry.render_height !== entry.height
        ) {
          r.setSize(entry.width, entry.height, false)
          entry.render_width = entry.width
          entry.render_height = entry.height
        }
        entry.scene_controller.update(frame_state, entry.input.state)
        r.render(entry.scene_controller.scene, entry.camera)

        if (wipe_t >= 1)
          entry.ctx2d.drawImage(r.domElement, 0, 0, entry.width, entry.height)
        else {
          entry.ctx2d.clearRect(0, 0, entry.width, entry.height)
          if (wipe_t > 0) {
            const edge_px = entry.width * wipe_t
            const soft_px = Math.min(WIPE_SOFT_EDGE_PX_MAX, edge_px)
            entry.ctx2d.drawImage(r.domElement, 0, 0, entry.width, entry.height)
            const grad = wipe_gradient(
              entry.ctx2d,
              edge_px,
              soft_px,
              entry.wipe_grad,
              entry.wipe_grad_key
            )
            entry.wipe_grad = grad
            entry.wipe_grad_key = `${edge_px}|${soft_px}`
            entry.ctx2d.globalCompositeOperation = 'destination-in'
            entry.ctx2d.fillStyle = grad
            entry.ctx2d.fillRect(0, 0, Math.ceil(edge_px), entry.height)
            entry.ctx2d.globalCompositeOperation = 'source-over'
          }
        }

        entry.input.reset_frame_deltas()
      }
    }
  })
  loop.start()
}

export const register_viewer = (canvas, scene_controller) => {
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    1,
    CAMERA_NEAR,
    CAMERA_FAR
  )
  camera.position.set(0, 0, CAMERA_DISTANCE)
  scene_controller.mount({ camera })

  const input = create_input({ canvas })
  const ctx2d = canvas.getContext('2d')
  /** @type {{
   *   canvas: HTMLCanvasElement,
   *   ctx2d: CanvasRenderingContext2D | null,
   *   scene_controller: import('@/3d/engine/types.js').PosterSceneController,
   *   input: ReturnType<typeof create_input>,
   *   camera: import('three').PerspectiveCamera,
   *   width: number,
   *   height: number,
   *   render_width: number,
   *   render_height: number,
   *   phase: string,
   *   elapsed: number,
   *   wipe_t: number,
   *   wipe_grad: CanvasGradient | null,
   *   wipe_grad_key: string,
   *   on_svg_zoom: ((t: number) => void) | null,
   *   on_leave_done: (() => void) | null
   * }} */
  const entry = {
    canvas,
    ctx2d,
    scene_controller,
    input,
    camera,
    width: 0,
    height: 0,
    render_width: 0,
    render_height: 0,
    phase: 'idle',
    elapsed: 0,
    wipe_t: 0,
    wipe_grad: null,
    wipe_grad_key: '',
    on_svg_zoom: null,
    on_leave_done: null
  }

  const apply_size = () => {
    const rect = canvas.getBoundingClientRect()
    entry.width = Math.max(1, Math.floor(rect.width))
    entry.height = Math.max(1, Math.floor(rect.height))
    canvas.width = entry.width
    canvas.height = entry.height
    camera.aspect = entry.width / entry.height
    camera.updateProjectionMatrix()
    scene_controller.on_resize({ width: entry.width, height: entry.height })
  }

  // Seed dimensions immediately so first frame isn't skipped
  apply_size()

  const resize_observer = new ResizeObserver(apply_size)
  resize_observer.observe(canvas)

  // IntersectionObserver only manages visibility after enter animation completes
  const intersection_observer = new IntersectionObserver(
    ([e]) => {
      if (entry.phase !== 'done') return
      if (e.isIntersecting) visible.add(entry)
      else visible.delete(entry)
    },
    { threshold: 0.01 }
  )
  intersection_observer.observe(canvas)

  entries.push(entry)
  ensure_loop()

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    resize_observer.disconnect()
    intersection_observer.disconnect()
    entry.input.dispose()
    entry.scene_controller.dispose()
    visible.delete(entry)
    const idx = entries.indexOf(entry)
    if (idx !== -1) entries.splice(idx, 1)
    if (entries.length === 0 && loop) {
      loop.stop()
      loop = null
    }
  }

  return {
    start_enter(on_svg_zoom) {
      entry.on_svg_zoom = on_svg_zoom
      entry.phase = 'enter'
      entry.elapsed = 0
      entry.wipe_t = 0
      visible.add(entry)
    },
    start_leave(on_svg_zoom, on_done) {
      entry.on_svg_zoom = on_svg_zoom
      entry.on_leave_done = () => {
        cleanup()
        on_done?.()
      }
      entry.phase = 'leave'
      entry.elapsed = 0
    },
    destroy() {
      entry.phase = 'idle'
      entry.on_svg_zoom = null
      entry.on_leave_done = null
      cleanup()
    }
  }
}
