import * as THREE from 'three'
import {
  BREATHING_TILT,
  DRIFT_FREQ_Y,
  DRIFT_PHASE_X,
  DRIFT_PHASE_Y,
  MAX_ZOOM,
  MIN_ZOOM,
  MOSAIC_BASE_PARALLAX,
  MOSAIC_PARALLAX_GAIN,
  PAN_DEG_TO_RAD,
  PAN_FOV_HALF_DEG,
  PAN_SMOOTH_RATE,
  PAN_VELOCITY_SMOOTH,
  PAN_VELOCITY_TILT,
  PAN_WHEEL_SCALE,
  PAN_ZOOM_BASE_DISTANCE,
  PARALLAX_AMOUNT,
  POINTER_SMOOTH,
  SHADOW_BASE_PARALLAX,
  SHADOW_PARALLAX_GAIN,
  STROKE_BASE_OPACITY,
  STROKE_MIN_OPACITY,
  TOUCH_TILT_BLEND,
  TILT_SMOOTH,
  WHEEL_ZOOM_STEP,
  ZOOM_EPSILON,
  ZOOM_SMOOTH_RATE
} from '@/3d/scenes/poster-scene-config.js'
import {
  clamp_pan_to_bounds,
  clamp_tilt_target_to_bounds,
  enforce_poster_view_bounds
} from '@/3d/scenes/poster-scene-bounds.js'
import {
  nudge_pan,
  smooth_toward,
  stroke_pulse_opacity
} from '@/3d/scenes/poster-scene-motion.js'

/**
 * @param {object} options
 * @param {object} options.runtime
 * @param {object} options.frame_state
 * @param {object} options.input_state
 * @param {boolean} options.cinematic
 * @param {boolean} options.pan_navigating
 * @param {number} options.delta_s
 */
const update_layer_parallax = ({
  runtime,
  frame_state,
  input_state,
  cinematic,
  pan_navigating,
  delta_s
}) => {
  const {
    root,
    layer_groups,
    smooth,
    pan,
    get_mosaic_spread,
    get_shadow_spread,
    get_motion_enabled,
    get_drift_amount,
    get_drift_speed
  } = runtime

  if (!pan_navigating) {
    smooth.x += (input_state.pointer_x_norm - smooth.x) * POINTER_SMOOTH
    smooth.y += (input_state.pointer_y_norm - smooth.y) * POINTER_SMOOTH
  }

  const pan_rate = cinematic ? PAN_SMOOTH_RATE : 0
  pan.current.x = smooth_toward(pan.current.x, pan.target.x, pan_rate, delta_s)
  pan.current.y = smooth_toward(pan.current.y, pan.target.y, pan_rate, delta_s)

  if (cinematic && delta_s > 0) {
    const vx = (pan.current.x - pan.prev.x) / delta_s
    const vy = (pan.current.y - pan.prev.y) / delta_s
    const vel_blend = 1 - Math.exp(-PAN_VELOCITY_SMOOTH * delta_s)
    pan.velocity.x += (vx - pan.velocity.x) * vel_blend
    pan.velocity.y += (vy - pan.velocity.y) * vel_blend
  } else {
    pan.velocity.x = 0
    pan.velocity.y = 0
  }
  pan.prev.x = pan.current.x
  pan.prev.y = pan.current.y

  root.position.x = pan.current.x
  root.position.y = pan.current.y

  const mosaic_spread = get_mosaic_spread()
  const shadow_spread = get_shadow_spread()
  const motion_enabled = get_motion_enabled()
  const drift_amount = get_drift_amount()
  const drift_speed = get_drift_speed()
  const drift_t = frame_state.elapsed_s * drift_speed

  for (let i = 0; i < layer_groups.length; i++) {
    const layer = layer_groups[i]
    const raw =
      layer.kind === 'mosaic'
        ? MOSAIC_BASE_PARALLAX +
          layer.parallax_offset * mosaic_spread * MOSAIC_PARALLAX_GAIN
        : SHADOW_BASE_PARALLAX +
          layer.parallax_offset * shadow_spread * SHADOW_PARALLAX_GAIN
    const p = Math.max(0, raw)
    const drift_dx = motion_enabled
      ? Math.sin(drift_t + i * DRIFT_PHASE_X) * drift_amount
      : 0
    const drift_dy = motion_enabled
      ? Math.cos(drift_t * DRIFT_PHASE_Y + i * DRIFT_FREQ_Y) * drift_amount
      : 0
    layer.group.position.x = -smooth.x * PARALLAX_AMOUNT * p + drift_dx
    layer.group.position.y = smooth.y * PARALLAX_AMOUNT * p + drift_dy
  }
}

/**
 * @param {object} runtime
 * @param {object} frame_state
 * @param {object} input_state
 * @param {boolean} cinematic
 * @param {boolean} pan_navigating
 */
const update_tilt_and_atmosphere = (
  runtime,
  frame_state,
  input_state,
  cinematic,
  pan_navigating
) => {
  const {
    scene,
    root,
    plane_w,
    plane_h,
    get_camera,
    get_motion_enabled,
    get_breathing_amount,
    get_breathing_speed,
    get_tilt_amount,
    get_gyro_amount,
    get_atmosphere_enabled,
    get_atmosphere_density,
    pan,
    zoom,
    tilt
  } = runtime

  const gyro_amount = get_gyro_amount()
  const tilt_amount = get_tilt_amount()

  const input_x = THREE.MathUtils.clamp(
    input_state.arrow_x + input_state.gyro_x * gyro_amount,
    -1,
    1
  )
  const input_y = THREE.MathUtils.clamp(
    input_state.arrow_y + input_state.gyro_y * gyro_amount,
    -1,
    1
  )
  let target_tilt_y = -input_x * tilt_amount
  let target_tilt_x = input_y * tilt_amount
  if (input_state.touch_active) {
    target_tilt_y +=
      -input_state.pointer_x_norm * tilt_amount * TOUCH_TILT_BLEND
    target_tilt_x += input_state.pointer_y_norm * tilt_amount * TOUCH_TILT_BLEND
  }
  if (cinematic && pan_navigating) {
    target_tilt_y -= pan.velocity.x * PAN_VELOCITY_TILT
    target_tilt_x += pan.velocity.y * PAN_VELOCITY_TILT
  }
  const clamped_tilt = clamp_tilt_target_to_bounds({
    camera: get_camera(),
    plane_w,
    plane_h,
    pan: pan.current,
    zoom_z: zoom.current,
    current_tilt: tilt,
    target_tilt_x,
    target_tilt_y
  })
  target_tilt_x = clamped_tilt.x
  target_tilt_y = clamped_tilt.y
  tilt.y += (target_tilt_y - tilt.y) * TILT_SMOOTH
  tilt.x += (target_tilt_x - tilt.x) * TILT_SMOOTH

  const motion_enabled = get_motion_enabled()
  const breathing_speed = get_breathing_speed()
  const breath_sin = motion_enabled
    ? Math.sin(frame_state.elapsed_s * breathing_speed)
    : 0
  const breath_cos = motion_enabled
    ? Math.cos(frame_state.elapsed_s * breathing_speed)
    : 0
  root.rotation.y = tilt.y + breath_cos * BREATHING_TILT
  root.rotation.x = tilt.x + breath_sin * BREATHING_TILT

  const breathing_amount = get_breathing_amount()
  root.scale.set(
    1 + breath_sin * breathing_amount,
    1 + breath_sin * breathing_amount,
    1 + breath_sin * breathing_amount
  )

  if (get_atmosphere_enabled()) {
    const reach =
      tilt_amount > 0
        ? Math.min(1, Math.hypot(tilt.x, tilt.y) / tilt_amount)
        : 0
    scene.fog.density = get_atmosphere_density() * reach
  } else scene.fog.density = 0
}

/**
 * @param {object} runtime
 * @param {object} frame_state
 */
const update_stroke_pulse = (runtime, frame_state) => {
  const { get_stroke_visible, get_motion_enabled, stroke_materials, appliers } =
    runtime

  if (!get_stroke_visible() || !get_motion_enabled()) {
    appliers.apply_stroke_opacity()
    return
  }

  for (const entry of stroke_materials) {
    if (!entry.loaded) continue
    entry.material.opacity =
      entry.base_opacity *
      stroke_pulse_opacity(
        frame_state.elapsed_s,
        entry.period,
        STROKE_BASE_OPACITY,
        STROKE_MIN_OPACITY
      )
  }
}

/**
 * @param {object} runtime
 */
export const create_poster_scene_update = runtime => {
  const {
    root,
    plane_w,
    plane_h,
    get_camera,
    pan,
    zoom,
    tilt,
    pointer,
    camera,
    raycast,
    get_reduced_motion
  } = runtime

  const pan_world_per_px = () => {
    const distance = PAN_ZOOM_BASE_DISTANCE - zoom.current
    return (
      (2 * distance * Math.tan((PAN_FOV_HALF_DEG * Math.PI) / PAN_DEG_TO_RAD)) /
      camera.canvas_height
    )
  }

  const bounds_view = () => ({
    camera: get_camera(),
    plane_w,
    plane_h,
    zoom_z: zoom.current,
    tilt
  })

  return (frame_state, input_state) => {
    const delta_s = frame_state.delta_s || 0
    const cinematic = !get_reduced_motion()
    const pan_navigating =
      input_state.shift_held || input_state.alt_held || input_state.touch_active

    pointer.x = input_state.pointer_x_norm
    pointer.y = input_state.pointer_y_norm

    const world_per_px = pan_world_per_px()

    if (pan_navigating) {
      if (input_state.shift_held || input_state.touch_active) {
        pan.target.x += input_state.pointer_dx * world_per_px
        pan.target.x -= input_state.pan_wheel_x * world_per_px * PAN_WHEEL_SCALE
      }
      if (input_state.alt_held || input_state.touch_active) {
        pan.target.y -= input_state.pointer_dy * world_per_px
        pan.target.y += input_state.pan_wheel_y * world_per_px * PAN_WHEEL_SCALE
      }
      clamp_pan_to_bounds({ ...bounds_view(), pan: pan.target })
    }

    update_layer_parallax({
      runtime,
      frame_state,
      input_state,
      cinematic,
      pan_navigating,
      delta_s
    })
    clamp_pan_to_bounds({ ...bounds_view(), pan: pan.current })

    const before = raycast.world_cursor_at_z(
      root.position.z,
      raycast.cursor_before
    )

    zoom.target = THREE.MathUtils.clamp(
      zoom.target - input_state.wheel_delta * WHEEL_ZOOM_STEP,
      MIN_ZOOM,
      MAX_ZOOM
    )
    const prev_zoom = zoom.current
    const zoom_rate = cinematic ? ZOOM_SMOOTH_RATE : 0
    zoom.current = smooth_toward(zoom.current, zoom.target, zoom_rate, delta_s)
    root.position.z = zoom.current

    if (before && Math.abs(zoom.current - prev_zoom) > ZOOM_EPSILON) {
      const after = raycast.world_cursor_at_z(
        root.position.z,
        raycast.cursor_after
      )
      if (after) {
        nudge_pan(pan, before.x - after.x, before.y - after.y)
        root.position.x = pan.current.x
        root.position.y = pan.current.y
      }
    }

    enforce_poster_view_bounds({
      get_camera,
      plane_w,
      plane_h,
      pan,
      zoom_z: zoom.current,
      tilt,
      snap_pan: !cinematic
    })
    root.position.x = pan.current.x
    root.position.y = pan.current.y

    update_tilt_and_atmosphere(
      runtime,
      frame_state,
      input_state,
      cinematic,
      pan_navigating
    )
    update_stroke_pulse(runtime, frame_state)
  }
}
