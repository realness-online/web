import { useStorage as storage } from '@vueuse/core'
import { DEFAULT_ANIMATION_SPEED } from '@/utils/animation-config'
import {
  DEFAULT_MOSAIC_SPREAD,
  DEFAULT_MOSAIC_OPACITY,
  DEFAULT_SHADOW_SPREAD,
  DEFAULT_SHADOW_OPACITY,
  DEFAULT_GROUP_GAP,
  DEFAULT_TILT_AMOUNT,
  DEFAULT_GYRO_AMOUNT,
  DEFAULT_ATMOSPHERE_COLOR,
  DEFAULT_ATMOSPHERE_DENSITY,
  DEFAULT_DRIFT_AMOUNT,
  DEFAULT_DRIFT_SPEED,
  DEFAULT_BREATHING_AMOUNT,
  DEFAULT_BREATHING_SPEED
} from '@/utils/preference-defaults.js'

export const animate = storage('animate', false)
export const color_cycle = storage('color_cycle', true)
export const drama = storage('drama', false)
export const drama_back = storage('drama_back', false)
export const drama_front = storage('drama_front', false)

export const shadow = storage('shadow', true)
export const stroke = storage('stroke', true)
export const mosaic = storage('mosaic', true)

export const bold = storage('bold', true)
export const medium = storage('medium', true)
export const regular = storage('regular', true)
export const light = storage('light', true)
export const background = storage('background', true)

export const boulders = storage('boulder', true)
export const rocks = storage('rock', true)
export const gravel = storage('gravel', true)
export const sand = storage('sand', true)
export const sediment = storage('sediment', true)

export const geology_layer_prefs = {
  boulders,
  rocks,
  gravel,
  sand,
  sediment
}

export const enable_geology_layers = () => {
  for (const pref of Object.values(geology_layer_prefs)) pref.value = true
}

export const enable_shadow_layers = () => {
  bold.value = true
  medium.value = true
  regular.value = true
  light.value = true
  background.value = true
}

export const info = storage('info', false)
export const storytelling = storage('storytelling', false)
export const only_mine = storage('only_mine', false)

export const animation_speed = storage(
  'animation_speed',
  DEFAULT_ANIMATION_SPEED
)

export const grid = storage('grid', false)
export const aspect_ratio_mode = storage('aspect_ratio_mode', 'auto')
export const slice_alignment = storage('slice_alignment', 'ymid')

export const menu = storage('menu', true)
export const footer_visible = storage('footer_visible', true)

export const sync_folder = storage('sync_folder', false)
export const sync_svg = storage('sync_svg', true)
export const notifications = storage('notifications', false)
export const notifications_prompted = storage('notifications_prompted', false)

export const view_3d = storage('3d', false)

export const mosaic_spread = storage('mosaic_spread', DEFAULT_MOSAIC_SPREAD)
export const mosaic_opacity = storage('mosaic_opacity', DEFAULT_MOSAIC_OPACITY)
export const shadow_spread = storage('shadow_spread', DEFAULT_SHADOW_SPREAD)
export const shadow_opacity = storage('shadow_opacity', DEFAULT_SHADOW_OPACITY)
export const group_gap = storage('group_gap', DEFAULT_GROUP_GAP)
export const tilt_amount = storage('tilt_amount', DEFAULT_TILT_AMOUNT)
export const gyro_amount = storage('gyro_amount', DEFAULT_GYRO_AMOUNT)
export const atmosphere_enabled = storage('atmosphere_enabled', true)
export const atmosphere_color = storage(
  'atmosphere_color',
  DEFAULT_ATMOSPHERE_COLOR
)
export const atmosphere_density = storage(
  'atmosphere_density',
  DEFAULT_ATMOSPHERE_DENSITY
)
export const drift_amount = storage('drift_amount', DEFAULT_DRIFT_AMOUNT)
export const drift_speed = storage('drift_speed', DEFAULT_DRIFT_SPEED)
export const breathing_amount = storage(
  'breathing_amount',
  DEFAULT_BREATHING_AMOUNT
)
export const breathing_speed = storage(
  'breathing_speed',
  DEFAULT_BREATHING_SPEED
)

export const reset_preferences = () => {
  animate.value = false
  color_cycle.value = true
  drama.value = false
  drama_back.value = false
  drama_front.value = false
  shadow.value = true
  stroke.value = true
  mosaic.value = true
  bold.value = true
  medium.value = true
  regular.value = true
  light.value = true
  background.value = true
  boulders.value = true
  rocks.value = true
  gravel.value = true
  sand.value = true
  sediment.value = true
  info.value = false
  storytelling.value = false
  only_mine.value = false
  animation_speed.value = DEFAULT_ANIMATION_SPEED
  grid.value = false
  aspect_ratio_mode.value = 'auto'
  slice_alignment.value = 'ymid'
  menu.value = true
  footer_visible.value = true
  sync_folder.value = false
  sync_svg.value = true
  notifications.value = false
  notifications_prompted.value = false
  view_3d.value = false
  mosaic_spread.value = DEFAULT_MOSAIC_SPREAD
  mosaic_opacity.value = DEFAULT_MOSAIC_OPACITY
  shadow_spread.value = DEFAULT_SHADOW_SPREAD
  shadow_opacity.value = DEFAULT_SHADOW_OPACITY
  group_gap.value = DEFAULT_GROUP_GAP
  tilt_amount.value = DEFAULT_TILT_AMOUNT
  gyro_amount.value = DEFAULT_GYRO_AMOUNT
  atmosphere_enabled.value = true
  atmosphere_color.value = DEFAULT_ATMOSPHERE_COLOR
  atmosphere_density.value = DEFAULT_ATMOSPHERE_DENSITY
  drift_amount.value = DEFAULT_DRIFT_AMOUNT
  drift_speed.value = DEFAULT_DRIFT_SPEED
  breathing_amount.value = DEFAULT_BREATHING_AMOUNT
  breathing_speed.value = DEFAULT_BREATHING_SPEED
}
