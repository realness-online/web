import * as THREE from 'three'
import { describe, it, expect, beforeEach, vi } from 'vite-plus/test'
import { create_poster_scene_update } from '@/3d/scenes/create-poster-scene-update.js'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  INITIAL_ZOOM,
  PARALLAX_AMOUNT
} from '@/3d/scenes/poster-scene-config.js'

const frame_state = { elapsed_s: 1.5, delta_s: 1 / 60 }

const input_state = () => ({
  pointer_x_norm: 0,
  pointer_y_norm: 0,
  pointer_dx: 0,
  pointer_dy: 0,
  pan_wheel_x: 0,
  pan_wheel_y: 0,
  wheel_delta: 0,
  shift_held: false,
  alt_held: false,
  cmd_held: false,
  arrow_x: 0,
  arrow_y: 0,
  gyro_x: 0,
  gyro_y: 0
})

const make_runtime = (overrides = {}) => {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x000000, 0)
  const root = new THREE.Group()
  const mosaic_group = new THREE.Group()
  const shadow_group = new THREE.Group()
  const layer_groups = [
    { kind: 'mosaic', parallax_offset: 2, group: mosaic_group },
    { kind: 'shadow', parallax_offset: 1, group: shadow_group }
  ]
  const smooth = { x: 0, y: 0 }
  const pan = {
    target: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    prev: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 }
  }
  const zoom = { target: INITIAL_ZOOM, current: INITIAL_ZOOM }
  const tilt = { x: 0, y: 0 }
  const pointer = { x: 0, y: 0 }
  const camera = { canvas_height: 400 }
  const cursor_before = new THREE.Vector3()
  const cursor_after = new THREE.Vector3()
  const raycast = {
    cursor_before,
    cursor_after,
    world_cursor_at_z: vi.fn(() => null)
  }

  return {
    scene,
    root,
    layer_groups,
    get_mosaic_spread: () => 0.1,
    get_shadow_spread: () => 0.1,
    get_motion_enabled: () => false,
    get_drift_amount: () => 0.05,
    get_drift_speed: () => 1,
    get_breathing_amount: () => 0,
    get_breathing_speed: () => 1,
    get_tilt_amount: () => 0.5,
    get_gyro_amount: () => 1,
    get_haze_enabled: () => true,
    get_haze_density: () => 0.2,
    smooth,
    pan,
    zoom,
    tilt,
    pointer,
    camera,
    raycast,
    get_reduced_motion: () => false,
    ...overrides
  }
}

describe('create_poster_scene_update', () => {
  let update

  beforeEach(() => {
    update = create_poster_scene_update(make_runtime())
  })

  it('applies parallax to mosaic and shadow groups from pointer smooth', () => {
    const runtime = make_runtime()
    update = create_poster_scene_update(runtime)
    const input = input_state()
    input.pointer_x_norm = 1
    input.pointer_y_norm = -1

    update(frame_state, input)

    const mosaic = runtime.layer_groups[0].group
    expect(mosaic.position.x).toBeLessThan(0)
    expect(mosaic.position.y).toBeLessThan(0)
    expect(mosaic.position.x).not.toBe(0)
  })

  it('pans toward target when shift is held instead of updating smooth', () => {
    const runtime = make_runtime()
    update = create_poster_scene_update(runtime)
    const input = input_state()
    input.shift_held = true
    input.pointer_dx = 10
    runtime.smooth.x = 0.25

    update({ ...frame_state, delta_s: 1 / 60 }, input)

    expect(runtime.pan.target.x).not.toBe(0)
    expect(runtime.root.position.x).not.toBe(runtime.pan.target.x)
    expect(runtime.smooth.x).toBe(0.25)
  })

  it('settles pan current toward target over multiple frames', () => {
    const runtime = make_runtime()
    update = create_poster_scene_update(runtime)
    const input = input_state()
    input.shift_held = true
    input.pointer_dx = 100

    update({ elapsed_s: 0, delta_s: 1 / 60 }, input)
    const target_x = runtime.pan.target.x
    for (let i = 0; i < 90; i++)
      update({ elapsed_s: i / 60, delta_s: 1 / 60 }, input_state())

    expect(runtime.pan.target.x).toBe(target_x)
    expect(runtime.root.position.x).toBeCloseTo(target_x, 2)
  })

  it('snaps pan when reduced motion is preferred', () => {
    const runtime = make_runtime({ get_reduced_motion: () => true })
    update = create_poster_scene_update(runtime)
    const input = input_state()
    input.shift_held = true
    input.pointer_dx = 50

    update({ elapsed_s: 0, delta_s: 1 / 60 }, input)

    expect(runtime.root.position.x).toBe(runtime.pan.target.x)
  })

  it('clamps zoom target between MIN_ZOOM and MAX_ZOOM', () => {
    const runtime = make_runtime()
    update = create_poster_scene_update(runtime)
    const input = input_state()
    input.wheel_delta = -1_000_000

    update(frame_state, input)

    expect(runtime.zoom.target).toBe(MAX_ZOOM)

    input.wheel_delta = 1_000_000
    update(frame_state, input)

    expect(runtime.zoom.target).toBe(MIN_ZOOM)
  })

  it('does not drift layers when motion is disabled', () => {
    const runtime = make_runtime({
      get_motion_enabled: () => false,
      get_drift_amount: () => 1
    })
    update = create_poster_scene_update(runtime)
    const mosaic = runtime.layer_groups[0].group
    mosaic.position.set(0, 0, 0)

    update(frame_state, input_state())
    const after_first = mosaic.position.clone()

    update({ elapsed_s: 99 }, input_state())

    expect(mosaic.position.x).toBe(after_first.x)
    expect(mosaic.position.y).toBe(after_first.y)
  })

  it('drifts layers when motion is enabled', () => {
    const runtime = make_runtime({
      get_motion_enabled: () => true,
      get_drift_amount: () => 0.2
    })
    update = create_poster_scene_update(runtime)
    const mosaic = runtime.layer_groups[0].group

    update({ elapsed_s: 0 }, input_state())
    const x0 = mosaic.position.x

    update({ elapsed_s: 5 }, input_state())

    expect(mosaic.position.x).not.toBe(x0)
  })

  it('sets fog density to zero when haze is disabled', () => {
    const runtime = make_runtime({ get_haze_enabled: () => false })
    update = create_poster_scene_update(runtime)
    runtime.tilt.x = 1
    runtime.tilt.y = 1

    update(frame_state, input_state())

    expect(runtime.scene.fog.density).toBe(0)
  })

  it('lerps zoom.current toward target each frame', () => {
    const runtime = make_runtime()
    update = create_poster_scene_update(runtime)
    runtime.zoom.target = INITIAL_ZOOM
    runtime.zoom.current = MIN_ZOOM
    const input = input_state()
    input.wheel_delta = 0

    update({ ...frame_state, delta_s: 1 / 60 }, input)

    expect(runtime.zoom.current).toBeGreaterThan(MIN_ZOOM)
    expect(runtime.zoom.current).toBeLessThan(INITIAL_ZOOM)
  })
})
