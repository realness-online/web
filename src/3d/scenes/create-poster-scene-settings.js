/**
 * @param {object} state
 * @param {object} appliers
 */
export const create_poster_scene_settings = (state, appliers) => ({
  get_settings() {
    return {
      mosaic_spread: state.mosaic_spread,
      mosaic_opacity: state.mosaic_opacity,
      shadow_spread: state.shadow_spread,
      shadow_opacity: state.shadow_opacity,
      mosaic_visible: state.mosaic_visible,
      shadow_visible: state.shadow_visible,
      stroke_visible: state.stroke_visible,
      group_gap: state.group_gap,
      tilt_amount: state.tilt_amount,
      gyro_amount: state.gyro_amount,
      atmosphere_enabled: state.atmosphere_enabled,
      atmosphere_color: state.atmosphere_color,
      atmosphere_density: state.atmosphere_density,
      drift_amount: state.drift_amount,
      drift_speed: state.drift_speed,
      breathing_amount: state.breathing_amount,
      breathing_speed: state.breathing_speed,
      motion_enabled: state.motion_enabled
    }
  },
  set_mosaic_spread(value) {
    if (state.mosaic_spread === value) return
    state.mosaic_spread = value
    appliers.apply_mosaic_spread()
  },
  set_mosaic_opacity(value) {
    state.mosaic_opacity = value
    appliers.apply_mosaic_opacity()
  },
  set_shadow_spread(value) {
    if (state.shadow_spread === value) return
    state.shadow_spread = value
    appliers.apply_shadow_z()
  },
  set_shadow_opacity(value) {
    state.shadow_opacity = value
    appliers.apply_shadow_opacity()
  },
  set_mosaic_visible(value) {
    if (state.mosaic_visible === value) return
    state.mosaic_visible = value
    appliers.apply_mosaic_visibility()
  },
  set_shadow_visible(value) {
    if (state.shadow_visible === value) return
    state.shadow_visible = value
    appliers.apply_shadow_visibility()
  },
  set_stroke_visible(value) {
    if (state.stroke_visible === value) return
    state.stroke_visible = value
    appliers.apply_stroke_visibility()
    appliers.apply_stroke_opacity()
  },
  set_group_gap(value) {
    if (state.group_gap === value) return
    state.group_gap = value
    appliers.apply_shadow_z()
  },
  set_tilt_amount(value) {
    if (state.tilt_amount === value) return
    state.tilt_amount = value
  },
  set_gyro_amount(value) {
    if (state.gyro_amount === value) return
    state.gyro_amount = value
  },
  set_atmosphere_enabled(value) {
    if (state.atmosphere_enabled === value) return
    state.atmosphere_enabled = value
    appliers.apply_atmosphere()
  },
  set_atmosphere_color(value) {
    if (state.atmosphere_color === value) return
    state.atmosphere_color = value
    appliers.apply_atmosphere()
  },
  set_atmosphere_density(value) {
    if (state.atmosphere_density === value) return
    state.atmosphere_density = value
  },
  set_drift_amount(value) {
    if (state.drift_amount === value) return
    state.drift_amount = value
  },
  set_drift_speed(value) {
    if (state.drift_speed === value) return
    state.drift_speed = value
  },
  set_breathing_amount(value) {
    if (state.breathing_amount === value) return
    state.breathing_amount = value
  },
  set_breathing_speed(value) {
    if (state.breathing_speed === value) return
    state.breathing_speed = value
  },
  set_motion_enabled(value) {
    if (state.motion_enabled === value) return
    state.motion_enabled = value
  },
  set_mosaic_layer_visible(name, visible) {
    if (state.mosaic_layer_visible[name] === visible) return
    state.mosaic_layer_visible[name] = visible
    appliers.apply_mosaic_visibility()
  },
  set_shadow_layer_visible(child_id, visible) {
    if (state.shadow_layer_visible[child_id] === visible) return
    state.shadow_layer_visible[child_id] = visible
    appliers.apply_shadow_visibility()
    appliers.apply_stroke_visibility()
  }
})
