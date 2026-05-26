const GYRO_RANGE_DEG = 28

const SCREEN_ANGLE_PORTRAIT = 0
const SCREEN_ANGLE_LANDSCAPE_RIGHT = 90
const SCREEN_ANGLE_LANDSCAPE_LEFT = -90
const SCREEN_ANGLE_LANDSCAPE_LEFT_ALT = 270
const SCREEN_ANGLE_UPSIDE_DOWN = 180

/** @type {PermissionState | 'unsupported' | 'unknown'} */
let permission_state = 'unknown'
/** @type {Promise<PermissionState | 'unsupported'> | null} */
let permission_request_promise = null
/** @type {Set<() => void>} */
const pending_enable = new Set()
let document_arm_active = false

const needs_ios_permission = () => {
  if (typeof window === 'undefined') return false
  if (typeof window.DeviceOrientationEvent === 'undefined') return false
  const Ctor =
    /** @type {typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> }} */ (
      window.DeviceOrientationEvent
    )
  return typeof Ctor.requestPermission === 'function'
}

const notify_pending_enable = () => {
  for (const enable of pending_enable) enable()
}

const clear_document_arm = () => {
  if (!document_arm_active || typeof document === 'undefined') return
  document_arm_active = false
  document.removeEventListener('pointerdown', on_document_gesture)
  document.removeEventListener('touchstart', on_document_gesture)
}

const on_document_gesture = () => {
  void request_device_orientation_permission({ force: true })
}

const ensure_document_arm = () => {
  if (document_arm_active || typeof document === 'undefined') return
  if (!needs_ios_permission()) return
  if (permission_state === 'granted' || permission_state === 'denied') return

  document_arm_active = true
  document.addEventListener('pointerdown', on_document_gesture, {
    passive: true
  })
  document.addEventListener('touchstart', on_document_gesture, {
    passive: true
  })
}

export const reset_device_orientation_state_for_tests = () => {
  permission_state = 'unknown'
  permission_request_promise = null
  pending_enable.clear()
  clear_document_arm()
}

/**
 * Arm iOS permission on the next user gesture when 3D is active.
 */
export const ensure_device_orientation_ready = () => {
  if (permission_state === 'granted' || permission_state === 'unsupported') {
    notify_pending_enable()
    return
  }
  ensure_document_arm()
}

/**
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<PermissionState | 'unsupported'>}
 */
export const request_device_orientation_permission = async (options = {}) => {
  const { force = false } = options
  if (typeof window === 'undefined') return 'unsupported'
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    permission_state = 'unsupported'
    return 'unsupported'
  }

  const Ctor =
    /** @type {typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> }} */ (
      window.DeviceOrientationEvent
    )
  if (typeof Ctor.requestPermission !== 'function') {
    permission_state = 'granted'
    clear_document_arm()
    notify_pending_enable()
    return 'granted'
  }

  const request_permission = Ctor.requestPermission

  if (permission_state === 'granted') return 'granted'
  if (!force && permission_state === 'denied') return 'denied'
  if (permission_request_promise) return permission_request_promise

  permission_request_promise = (async () => {
    try {
      const result = await request_permission()
      permission_state = result
      if (result === 'granted') {
        clear_document_arm()
        notify_pending_enable()
      }
      return result
    } catch {
      permission_state = 'denied'
      return 'denied'
    } finally {
      permission_request_promise = null
    }
  })()

  return await permission_request_promise
}

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
    canvas.removeEventListener('pointerdown', arm_orientation_on_gesture)
    canvas.removeEventListener('touchstart', arm_orientation_on_gesture)
    orientation_enabled = true
  }

  const try_enable_orientation = ({ force_permission = false } = {}) => {
    if (typeof window.DeviceOrientationEvent === 'undefined') return
    if (orientation_enabled) return

    if (permission_state === 'granted' || permission_state === 'unsupported') {
      enable_orientation()
      return
    }

    if (permission_state === 'denied' && !force_permission) return

    ensure_document_arm()
    request_device_orientation_permission({ force: force_permission }).then(
      result => {
        if (result === 'granted') enable_orientation()
      }
    )
  }

  const arm_orientation_on_gesture = () => {
    try_enable_orientation({ force_permission: true })
  }

  pending_enable.add(try_enable_orientation)
  canvas.addEventListener('pointerdown', arm_orientation_on_gesture)
  canvas.addEventListener('touchstart', arm_orientation_on_gesture)
  try_enable_orientation()

  return () => {
    pending_enable.delete(try_enable_orientation)
    canvas.removeEventListener('pointerdown', arm_orientation_on_gesture)
    canvas.removeEventListener('touchstart', arm_orientation_on_gesture)
    disable_orientation()
    state.gyro_x = 0
    state.gyro_y = 0
  }
}
