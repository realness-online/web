import * as THREE from 'three'
import { describe, it, expect } from 'vite-plus/test'
import {
  clamp_pan_to_bounds,
  clamp_tilt_target_to_bounds,
  get_poster_ndc_bounds,
  poster_covers_viewport
} from '@/3d/scenes/poster-scene-bounds.js'
import { CAMERA_DISTANCE, CAMERA_FOV } from '@/3d/engine/renderer-config.js'
import { INITIAL_ZOOM } from '@/3d/scenes/poster-scene-config.js'

const make_camera = (aspect = 1) => {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 100)
  camera.position.set(0, 0, CAMERA_DISTANCE)
  camera.updateProjectionMatrix()
  return camera
}

const centered_view = camera => ({
  camera,
  plane_w: 3.5,
  plane_h: 3.5,
  pan: { x: 0, y: 0 },
  zoom_z: INITIAL_ZOOM,
  tilt: { x: 0, y: 0 }
})

describe('poster-scene-bounds', () => {
  it('reports centered zoomed-in poster as covering the viewport', () => {
    const camera = make_camera()
    const bounds = get_poster_ndc_bounds(centered_view(camera))

    expect(bounds).not.toBeNull()
    expect(poster_covers_viewport(bounds)).toBe(true)
  })

  it('reports panned poster as uncovering the viewport', () => {
    const camera = make_camera()
    const bounds = get_poster_ndc_bounds({
      ...centered_view(camera),
      pan: { x: 4, y: 0 }
    })

    expect(poster_covers_viewport(bounds)).toBe(false)
  })

  it('clamps pan back into view', () => {
    const camera = make_camera()
    const pan = { x: 1.2, y: -0.8 }

    clamp_pan_to_bounds({
      ...centered_view(camera),
      pan
    })

    const bounds = get_poster_ndc_bounds({
      ...centered_view(camera),
      pan
    })
    expect(poster_covers_viewport(bounds)).toBe(true)
    expect(Math.abs(pan.x)).toBeLessThan(1.2)
  })

  it('scales tilt target down when it would overflow', () => {
    const camera = make_camera()
    const pan = { x: 0, y: 0 }
    const current_tilt = { x: 0, y: 0 }
    const target = clamp_tilt_target_to_bounds({
      ...centered_view(camera),
      pan,
      current_tilt,
      target_tilt_x: 0,
      target_tilt_y: 1.2
    })

    const bounds = get_poster_ndc_bounds({
      ...centered_view(camera),
      pan,
      tilt: target
    })
    expect(poster_covers_viewport(bounds)).toBe(true)
    expect(Math.abs(target.y)).toBeLessThan(1.2)
  })

  it('preserves full tilt target when poster still covers the viewport', () => {
    const camera = make_camera()
    const target = clamp_tilt_target_to_bounds({
      ...centered_view(camera),
      current_tilt: { x: 0, y: 0 },
      target_tilt_x: 0.1,
      target_tilt_y: -0.15
    })

    expect(target.x).toBeCloseTo(0.1)
    expect(target.y).toBeCloseTo(-0.15)
  })
})
