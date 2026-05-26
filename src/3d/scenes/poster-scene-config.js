import {
  DEFAULT_MOSAIC_SPREAD,
  DEFAULT_MOSAIC_OPACITY,
  DEFAULT_SHADOW_SPREAD,
  DEFAULT_SHADOW_OPACITY,
  DEFAULT_GROUP_GAP,
  DEFAULT_TILT_AMOUNT,
  DEFAULT_GYRO_AMOUNT,
  DEFAULT_HAZE_DENSITY,
  DEFAULT_DRIFT_AMOUNT,
  DEFAULT_DRIFT_SPEED,
  DEFAULT_BREATHING_AMOUNT,
  DEFAULT_BREATHING_SPEED
} from '@/utils/preference-defaults.js'

export const VECTOR_LAYERS = [
  { name: 'boulders', parallax_offset: -2, opacity: 1.0 },
  { name: 'rocks', parallax_offset: -1, opacity: 0.95 },
  { name: 'gravel', parallax_offset: 0, opacity: 0.85 },
  { name: 'sand', parallax_offset: 1, opacity: 0.75 },
  { name: 'sediment', parallax_offset: 2, opacity: 0.65 }
]

export const STROKE_LAYER_IDS = ['light', 'regular', 'medium', 'bold']

export const TEXTURE_LAYERS = [
  {
    name: 'shadow-background',
    symbol_id: 'shadows',
    child_id: 'background',
    parallax_offset: -2
  },
  {
    name: 'shadow-light',
    symbol_id: 'shadows',
    child_id: 'light',
    parallax_offset: -1
  },
  {
    name: 'shadow-regular',
    symbol_id: 'shadows',
    child_id: 'regular',
    parallax_offset: 0
  },
  {
    name: 'shadow-medium',
    symbol_id: 'shadows',
    child_id: 'medium',
    parallax_offset: 1
  },
  {
    name: 'shadow-bold',
    symbol_id: 'shadows',
    child_id: 'bold',
    parallax_offset: 2
  }
]

export const SCENE_BACKGROUND = 0xeae5dc
export const AMBIENT_LIGHT_COLOR = 0xffffff
export const AMBIENT_LIGHT_INTENSITY = 1.8
export const KEY_LIGHT_COLOR = 0xfff4e0
export const KEY_LIGHT_INTENSITY = 1.2
export const KEY_LIGHT_Y = 4
export const KEY_LIGHT_Z = 6
export const FILL_LIGHT_COLOR = 0xd0e8ff
export const FILL_LIGHT_INTENSITY = 0.4
export const FILL_LIGHT_Y = -3
export const FILL_LIGHT_Z = 4

export const INITIAL_MOSAIC_SPREAD = DEFAULT_MOSAIC_SPREAD
export const INITIAL_MOSAIC_OPACITY = DEFAULT_MOSAIC_OPACITY
export const MOSAIC_BASE_PARALLAX = 0.2
export const MOSAIC_PARALLAX_GAIN = 10.0

export const INITIAL_SHADOW_SPREAD = DEFAULT_SHADOW_SPREAD
export const INITIAL_SHADOW_OPACITY = DEFAULT_SHADOW_OPACITY
export const SHADOW_BASE_PARALLAX = 0.2
export const SHADOW_PARALLAX_GAIN = 2.5
export const SHADOW_Z_GAIN = 10
export const STROKE_Z_OFFSET = 0.001
export const STROKE_BASE_WIDTH = 0.33
export const STROKE_BASE_OPACITY = 0.9
export const STROKE_MIN_OPACITY = 0.1
export const STROKE_PULSE_PERIODS = {
  light: 6,
  regular: 10,
  medium: 10,
  bold: 6
}
export const STROKE_DASHARRAY = {
  light: '8, 16',
  regular: '13, 21',
  medium: '18, 26',
  bold: '4, 32'
}

export const INITIAL_GROUP_GAP = DEFAULT_GROUP_GAP
export const FIT_HEIGHT = 3.5
export const PARALLAX_AMOUNT = 0.35

export const MIN_ZOOM = -2.5
export const MAX_ZOOM = 2.5
export const INITIAL_ZOOM = MAX_ZOOM

export const INITIAL_TILT_AMOUNT = DEFAULT_TILT_AMOUNT
export const INITIAL_GYRO_AMOUNT = DEFAULT_GYRO_AMOUNT
export const TILT_SMOOTH = 0.08

export const INITIAL_HAZE_ENABLED = true
export const INITIAL_HAZE_COLOR = '#0e0c09'
export const INITIAL_HAZE_DENSITY = DEFAULT_HAZE_DENSITY

export const INITIAL_DRIFT_AMOUNT = DEFAULT_DRIFT_AMOUNT
export const INITIAL_DRIFT_SPEED = DEFAULT_DRIFT_SPEED

export const INITIAL_BREATHING_AMOUNT = DEFAULT_BREATHING_AMOUNT
export const INITIAL_BREATHING_SPEED = DEFAULT_BREATHING_SPEED
export const INITIAL_MOTION_ENABLED = false
export const BREATHING_TILT = 0.08

export const PAN_ZOOM_BASE_DISTANCE = 6
export const PAN_FOV_HALF_DEG = 17.5
export const PAN_DEG_TO_RAD = 180
export const POINTER_SMOOTH = 0.08
export const DRIFT_PHASE_X = 0.6
export const DRIFT_PHASE_Y = 0.7
export const DRIFT_FREQ_Y = 1.1
/** Cmd+wheel zoom sensitivity (pointer drag unchanged) */
export const WHEEL_ZOOM_STEP = 0.00035
/** Shift/Alt+wheel pan sensitivity vs hover drag */
export const PAN_WHEEL_SCALE = 0.18
/** Touch finger position adds this fraction of tilt_amount while dragging */
export const TOUCH_TILT_BLEND = 0.65
/** ~220ms settle at 60fps; wheel and drag pan feel cinematic, not stepped */
export const PAN_SMOOTH_RATE = 10
/** Pan velocity leaked into root tilt while Shift/Alt navigate */
export const PAN_VELOCITY_SMOOTH = 14
export const PAN_VELOCITY_TILT = 0.028
/** Cmd+wheel zoom; slightly faster than pan so depth stays responsive */
export const ZOOM_SMOOTH_RATE = 14
export const ZOOM_EPSILON = 1e-5
