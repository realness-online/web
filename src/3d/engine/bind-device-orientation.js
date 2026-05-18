const GYRO_RANGE_DEG = 28

const SCREEN_ANGLE_PORTRAIT = 0
const SCREEN_ANGLE_LANDSCAPE_RIGHT = 90
const SCREEN_ANGLE_LANDSCAPE_LEFT = -90
const SCREEN_ANGLE_LANDSCAPE_LEFT_ALT = 270
const SCREEN_ANGLE_UPSIDE_DOWN = 180

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   state: { gyro_x: number, gyro_y: number }
 * }} options
 * @returns {() => void}
 */
export const bind_device_orientation = options => {
  const { canvas, state } = options

  let gyro_neutral_beta = null
  let gyro_neutral_gamma = null
  let orientation_enabled = false

  const get_screen_angle = () => {
    if (screen.orientation && typeof screen.orientation.angle === 'number')
      return screen.orientation.angle

    if (typeof window.orientation === 'number') return window.orientation
    return SCREEN_ANGLE_PORTRAIT
  }

  const reset_gyro_neutral = () => {
    gyro_neutral_beta = null
    gyro_neutral_gamma = null
  }

  const on_orientation = event => {
    if (event.beta === null || event.gamma === null) return
    if (gyro_neutral_beta === null) {
      gyro_neutral_beta = event.beta
      gyro_neutral_gamma = event.gamma
      return
    }
    const dbeta = event.beta - gyro_neutral_beta
    const dgamma = event.gamma - gyro_neutral_gamma
    let nx, ny
    switch (get_screen_angle()) {
      case SCREEN_ANGLE_LANDSCAPE_RIGHT:
        nx = -dbeta
        ny = dgamma
        break
      case SCREEN_ANGLE_LANDSCAPE_LEFT:
      case SCREEN_ANGLE_LANDSCAPE_LEFT_ALT:
        nx = dbeta
        ny = -dgamma
        break
      case SCREEN_ANGLE_UPSIDE_DOWN:
        nx = -dgamma
        ny = dbeta
        break
      default:
        nx = dgamma
        ny = -dbeta
    }
    state.gyro_x = Math.max(-1, Math.min(1, nx / GYRO_RANGE_DEG))
    state.gyro_y = Math.max(-1, Math.min(1, ny / GYRO_RANGE_DEG))
  }

  const disable_orientation = () => {
    window.removeEventListener('deviceorientation', on_orientation)
    window.removeEventListener('orientationchange', reset_gyro_neutral)
    orientation_enabled = false
  }

  const enable_orientation = () => {
    if (orientation_enabled) return
    window.addEventListener('deviceorientation', on_orientation)
    window.addEventListener('orientationchange', reset_gyro_neutral)
    orientation_enabled = true
  }

  const try_enable_orientation = () => {
    if (typeof window.DeviceOrientationEvent === 'undefined') return
    const Ctor =
      /** @type {typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> }} */ (
        window.DeviceOrientationEvent
      )
    if (typeof Ctor.requestPermission === 'function') {
      Ctor.requestPermission()
        .then(result => {
          if (result === 'granted') enable_orientation()
        })
        .catch(() => {})
      return
    }
    enable_orientation()
  }

  const arm_orientation_on_gesture = () => {
    canvas.removeEventListener('pointerdown', arm_orientation_on_gesture)
    canvas.removeEventListener('touchstart', arm_orientation_on_gesture)
    try_enable_orientation()
  }

  canvas.addEventListener('pointerdown', arm_orientation_on_gesture)
  canvas.addEventListener('touchstart', arm_orientation_on_gesture)

  return () => {
    canvas.removeEventListener('pointerdown', arm_orientation_on_gesture)
    canvas.removeEventListener('touchstart', arm_orientation_on_gesture)
    disable_orientation()
    state.gyro_x = 0
    state.gyro_y = 0
  }
}
