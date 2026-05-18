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
  PAN_ZOOM_BASE_DISTANCE,
  PARALLAX_AMOUNT,
  POINTER_SMOOTH,
  SHADOW_BASE_PARALLAX,
  SHADOW_PARALLAX_GAIN,
  TILT_SMOOTH,
  WHEEL_ZOOM_STEP,
  ZOOM_EPSILON,
  ZOOM_LERP
} from './poster-scene-config.js'

/**
 * @param {object} runtime
 */
export const create_poster_scene_update = runtime => {
  const {
    scene,
    root,
    layer_groups,
    get_mosaic_spread,
    get_shadow_spread,
    get_motion_enabled,
    get_drift_amount,
    get_drift_speed,
    get_breathing_amount,
    get_breathing_speed,
    get_tilt_amount,
    get_gyro_amount,
    get_haze_enabled,
    get_haze_density,
    smooth,
    zoom,
    tilt,
    pointer,
    camera,
    raycast
  } = runtime

  return (frame_state, input_state) => {
    pointer.x = input_state.pointer_x_norm
    pointer.y = input_state.pointer_y_norm

    if (input_state.shift_held || input_state.alt_held) {
      const distance = PAN_ZOOM_BASE_DISTANCE - zoom.current
      const world_per_px =
        (2 *
          distance *
          Math.tan((PAN_FOV_HALF_DEG * Math.PI) / PAN_DEG_TO_RAD)) /
        camera.canvas_height
      if (input_state.shift_held) {
        root.position.x += input_state.pointer_dx * world_per_px
        root.position.x -= input_state.pan_wheel_x * world_per_px
      }
      if (input_state.alt_held) {
        root.position.y -= input_state.pointer_dy * world_per_px
        root.position.y += input_state.pan_wheel_y * world_per_px
      }
    } else {
      smooth.x += (input_state.pointer_x_norm - smooth.x) * POINTER_SMOOTH
      smooth.y += (input_state.pointer_y_norm - smooth.y) * POINTER_SMOOTH
    }

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
    zoom.current = THREE.MathUtils.lerp(zoom.current, zoom.target, ZOOM_LERP)
    root.position.z = zoom.current

    if (before && Math.abs(zoom.current - prev_zoom) > ZOOM_EPSILON) {
      const after = raycast.world_cursor_at_z(
        root.position.z,
        raycast.cursor_after
      )
      if (after) {
        root.position.x += before.x - after.x
        root.position.y += before.y - after.y
      }
    }

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
    const target_tilt_y = -input_x * tilt_amount
    const target_tilt_x = input_y * tilt_amount
    tilt.y += (target_tilt_y - tilt.y) * TILT_SMOOTH
    tilt.x += (target_tilt_x - tilt.x) * TILT_SMOOTH
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

    if (get_haze_enabled()) {
      const reach =
        tilt_amount > 0
          ? Math.min(1, Math.hypot(tilt.x, tilt.y) / tilt_amount)
          : 0
      scene.fog.density = get_haze_density() * reach
    } else scene.fog.density = 0
  }
}
