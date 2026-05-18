import * as THREE from 'three'
import { create_input } from './create-input.js'
import { create_loop } from './create-loop.js'
import { create_resize_observer } from './create-resize-observer.js'
import {
  CAMERA_DISTANCE,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  MAX_PIXEL_RATIO,
  RENDERER_CLEAR_ALPHA,
  RENDERER_CLEAR_COLOR
} from './renderer-config.js'

/**
 * @param {{ canvas: HTMLCanvasElement }} options
 */
export const create_app = options => {
  const { canvas } = options
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  )
  renderer.setClearColor(RENDERER_CLEAR_COLOR, RENDERER_CLEAR_ALPHA)

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    1,
    CAMERA_NEAR,
    CAMERA_FAR
  )
  camera.position.set(0, 0, CAMERA_DISTANCE)

  /** @type {import('./types.js').PosterSceneController | null} */
  let scene_controller = null
  /** @type {((frame_state: import('./types.js').FrameState) => void)[]} */
  const frame_listeners = []

  const input = create_input({ canvas })
  const resize = create_resize_observer({
    canvas,
    on_resize: ({ width, height, pixel_ratio }) => {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixel_ratio)
      renderer.setSize(width, height, false)
      scene_controller?.on_resize({ width, height })
    }
  })

  const loop = create_loop({
    tick: frame_state => {
      scene_controller?.update(frame_state, input.state)
      if (scene_controller) renderer.render(scene_controller.scene, camera)
      frame_listeners.forEach(listener => listener(frame_state))
      input.reset_frame_deltas()
    }
  })

  return {
    mount_scene(next_controller) {
      scene_controller = next_controller
      next_controller.mount({ camera })
      resize.sync_now()
    },
    on_frame(listener) {
      frame_listeners.push(listener)
    },
    get_renderer() {
      return renderer
    },
    start() {
      resize.start()
      loop.start()
    },
    stop() {
      loop.stop()
      resize.stop()
      input.dispose()
    }
  }
}
