/** @typedef {import('@/3d/engine/types.js').PosterSceneController} PosterSceneController */
import { watchEffect as watch_effect } from 'vue'
import {
  animate,
  mosaic,
  shadow,
  bold,
  medium,
  regular,
  light,
  background,
  boulders,
  rocks,
  gravel,
  sand,
  sediment,
  mosaic_spread,
  mosaic_opacity,
  shadow_spread,
  shadow_opacity,
  group_gap,
  tilt_amount,
  gyro_amount,
  haze_enabled,
  haze_color,
  haze_density,
  drift_amount,
  drift_speed,
  breathing_amount,
  breathing_speed
} from '@/utils/preference'

/**
 * @param {PosterSceneController} scene
 */
export const sync_poster_scene_preferences = scene => {
  scene.set_mosaic_visible(mosaic.value)
  scene.set_shadow_visible(shadow.value)
  scene.set_mosaic_spread(mosaic_spread.value)
  scene.set_mosaic_opacity(mosaic_opacity.value)
  scene.set_shadow_spread(shadow_spread.value)
  scene.set_shadow_opacity(shadow_opacity.value)
  scene.set_group_gap(group_gap.value)
  scene.set_tilt_amount(tilt_amount.value)
  scene.set_gyro_amount(gyro_amount.value)
  scene.set_haze_enabled(haze_enabled.value)
  scene.set_haze_color(haze_color.value)
  scene.set_haze_density(haze_density.value)
  scene.set_mosaic_layer_visible('boulders', boulders.value)
  scene.set_mosaic_layer_visible('rocks', rocks.value)
  scene.set_mosaic_layer_visible('gravel', gravel.value)
  scene.set_mosaic_layer_visible('sand', sand.value)
  scene.set_mosaic_layer_visible('sediment', sediment.value)
  scene.set_shadow_layer_visible('bold', bold.value)
  scene.set_shadow_layer_visible('medium', medium.value)
  scene.set_shadow_layer_visible('regular', regular.value)
  scene.set_shadow_layer_visible('light', light.value)
  scene.set_shadow_layer_visible('background', background.value)
  scene.set_motion_enabled(animate.value)
  scene.set_drift_amount(drift_amount.value)
  scene.set_drift_speed(drift_speed.value)
  scene.set_breathing_amount(breathing_amount.value)
  scene.set_breathing_speed(breathing_speed.value)
}

/**
 * @param {import('vue').Ref<PosterSceneController | null>} scene_ref
 */
export const use_poster_scene_preferences = scene_ref => {
  watch_effect(() => {
    const scene = scene_ref.value
    if (!scene) return
    sync_poster_scene_preferences(scene)
  })
}
