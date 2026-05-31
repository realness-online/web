const GYRO_RANGE_DEG = 28
const PERMISSION_GESTURE_DELAY_MS = 10

const SCREEN_ANGLE_PORTRAIT = 0
const SCREEN_ANGLE_LANDSCAPE_RIGHT = 90
const SCREEN_ANGLE_LANDSCAPE_LEFT = -90
const SCREEN_ANGLE_LANDSCAPE_LEFT_ALT = 270
const SCREEN_ANGLE_UPSIDE_DOWN = 180

/** @typedef {'unknown' | 'granted' | 'denied' | 'unsupported'} MotionPermissionState */

/** @type {Promise<PermissionState | 'unsupported' | 'denied'> | null} */
let permission_request = null
/** @type {Set<() => void>} */
const binding_callbacks = new Set()
/** @type {Set<(snapshot: GyroDebugSnapshot) => void>} */
const gyro_debug_listeners = new Set()

/** @typedef {{
 *   permission: MotionPermissionState,
 *   ios_permission_api: boolean,
 *   device_orientation_api: boolean,
 *   window_listeners: number,
 *   canvas_bindings: number,
 *   gyro_x: number,
 *   gyro_y: number,
 *   beta: number | null,
 *   gamma: number | null,
 *   neutral_set: boolean,
 *   event_count: number,
 *   last_event_ms: number | null
 * }} GyroDebugSnapshot */

/** @type {GyroDebugSnapshot} */
const gyro_debug = {
  permission: 'unknown',
  ios_permission_api: false,
  device_orientation_api: false,
  window_listeners: 0,
  canvas_bindings: 0,
  gyro_x: 0,
  gyro_y: 0,
  beta: null,
  gamma: null,
  neutral_set: false,
  event_count: 0,
  last_event_ms: null
}

let window_listener_count = 0

const publish_gyro_debug = patch => {
  Object.assign(gyro_debug, patch)
  gyro_debug.canvas_bindings = binding_callbacks.size
  gyro_debug.window_listeners = window_listener_count
  if (gyro_debug_listeners.size === 0) return
  gyro_debug.ios_permission_api = has_permission_api()
  gyro_debug.device_orientation_api =
    typeof window !== 'undefined' &&
    typeof window.DeviceOrientationEvent !== 'undefined'
  for (const listener of gyro_debug_listeners) listener(gyro_debug)
}

/** @returns {GyroDebugSnapshot} */
export const get_gyro_debug_snapshot = () => ({ ...gyro_debug })

/** @param {(snapshot: GyroDebugSnapshot) => void} listener */
export const subscribe_gyro_debug = listener => {
  publish_gyro_debug({})
  gyro_debug_listeners.add(listener)
  listener(gyro_debug)
  return () => gyro_debug_listeners.delete(listener)
}

const has_permission_api = () => {
  if (typeof window === 'undefined') return false
  if (typeof window.DeviceOrientationEvent === 'undefined') return false
  const orientation_event =
    /** @type {typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> }} */ (
      window.DeviceOrientationEvent
    )
  return typeof orientation_event.requestPermission === 'function'
}

const notify_bindings = () => {
  for (const callback of binding_callbacks) callback()
}

export const sync_motion_bindings = () => {
  notify_bindings()
}

const set_motion_permission = state => {
  publish_gyro_debug({ permission: state })
}

export const reset_motion_permission_state_for_tests = () => {
  permission_request = null
  binding_callbacks.clear()
  gyro_debug_listeners.clear()
  window_listener_count = 0
  publish_gyro_debug({
    permission: 'unknown',
    gyro_x: 0,
    gyro_y: 0,
    beta: null,
    gamma: null,
    neutral_set: false,
    event_count: 0,
    last_event_ms: null
  })
}

/** @returns {Promise<PermissionState | 'unsupported' | 'denied'>} */
export const request_motion_permission = () => {
  if (permission_request) return permission_request

  if (typeof window === 'undefined') {
    set_motion_permission('unsupported')
    notify_bindings()
    return Promise.resolve('unsupported')
  }
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    set_motion_permission('unsupported')
    notify_bindings()
    return Promise.resolve('unsupported')
  }

  const orientation_event =
    /** @type {typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> }} */ (
      window.DeviceOrientationEvent
    )

  if (typeof orientation_event.requestPermission !== 'function') {
    set_motion_permission('granted')
    notify_bindings()
    return Promise.resolve('granted')
  }

  permission_request = orientation_event
    .requestPermission()
    .then(result => {
      set_motion_permission(result === 'granted' ? 'granted' : 'denied')
      notify_bindings()
      return result
    })
    .catch(error => {
      set_motion_permission('denied')
      notify_bindings()
      return /** @type {const} */ ('denied')
    })
    .finally(() => {
      permission_request = null
    })

  return permission_request
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
  let cached_screen_angle = SCREEN_ANGLE_PORTRAIT

  const read_screen_angle = () => {
    if (screen.orientation && typeof screen.orientation.angle === 'number')
      return screen.orientation.angle

    if (typeof window.orientation === 'number') return window.orientation
    return SCREEN_ANGLE_PORTRAIT
  }

  const refresh_screen_angle = () => {
    cached_screen_angle = read_screen_angle()
  }

  const reset_gyro_neutral = () => {
    refresh_screen_angle()
    gyro_neutral_beta = null
    gyro_neutral_gamma = null
    publish_gyro_debug({ neutral_set: false })
  }

  const on_orientation = event => {
    if (event.beta === null || event.gamma === null) {
      publish_gyro_debug({
        beta: event.beta,
        gamma: event.gamma,
        last_event_ms: Date.now()
      })
      return
    }
    if (gyro_neutral_beta === null) {
      gyro_neutral_beta = event.beta
      gyro_neutral_gamma = event.gamma
      publish_gyro_debug({
        beta: event.beta,
        gamma: event.gamma,
        neutral_set: true,
        event_count: gyro_debug.event_count + 1,
        last_event_ms: Date.now()
      })
      return
    }
    const dbeta = event.beta - gyro_neutral_beta
    const dgamma = event.gamma - gyro_neutral_gamma
    let nx, ny
    switch (cached_screen_angle) {
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
    publish_gyro_debug({
      gyro_x: state.gyro_x,
      gyro_y: state.gyro_y,
      beta: event.beta,
      gamma: event.gamma,
      neutral_set: true,
      event_count: gyro_debug.event_count + 1,
      last_event_ms: Date.now()
    })
  }

  const disable_orientation = () => {
    if (!orientation_enabled) return
    window.removeEventListener('deviceorientation', on_orientation)
    window.removeEventListener('orientationchange', reset_gyro_neutral)
    orientation_enabled = false
    window_listener_count -= 1
    state.gyro_x = 0
    state.gyro_y = 0
    publish_gyro_debug({ gyro_x: 0, gyro_y: 0 })
  }

  const enable_orientation = () => {
    if (orientation_enabled) return
    refresh_screen_angle()
    window.addEventListener('deviceorientation', on_orientation)
    window.addEventListener('orientationchange', reset_gyro_neutral)
    orientation_enabled = true
    window_listener_count += 1
    publish_gyro_debug({})
  }

  const can_enable_now = () => {
    if (!has_permission_api()) return true
    return gyro_debug.permission === 'granted'
  }

  const sync_orientation = () => {
    if (typeof window.DeviceOrientationEvent === 'undefined') return
    if (!has_permission_api()) set_motion_permission('granted')

    // Always try to enable orientation listening
    if (can_enable_now()) enable_orientation()
    else if (orientation_enabled) disable_orientation()
  }

  let permission_request_pending = false

  const request_permission_on_gesture = event => {
    if (permission_request_pending) return
    permission_request_pending = true

    setTimeout(async () => {
      try {
        await request_motion_permission()
      } finally {
        permission_request_pending = false
      }
    }, PERMISSION_GESTURE_DELAY_MS)
  }

  canvas.addEventListener('click', request_permission_on_gesture)
  canvas.addEventListener('touchend', request_permission_on_gesture, {
    passive: true
  })

  binding_callbacks.add(sync_orientation)
  sync_orientation()

  return () => {
    canvas.removeEventListener('click', request_permission_on_gesture)
    canvas.removeEventListener('touchend', request_permission_on_gesture)
    binding_callbacks.delete(sync_orientation)
    disable_orientation()
    publish_gyro_debug({})
  }
}

if (typeof window !== 'undefined') {
  /** @type {Window & { __gyro_debug?: () => GyroDebugSnapshot }} */
  const win = window
  win.__gyro_debug = get_gyro_debug_snapshot
}
