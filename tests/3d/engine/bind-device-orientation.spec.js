import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'

import {
  bind_device_orientation,
  get_gyro_debug_snapshot,
  request_motion_permission,
  reset_motion_permission_state_for_tests,
  sync_motion_bindings
} from '@/3d/engine/bind-device-orientation.js'

describe('bind_device_orientation', () => {
  /** @type {HTMLCanvasElement} */
  let canvas
  const state = { gyro_x: 0, gyro_y: 0 }

  beforeEach(() => {
    vi.useFakeTimers()
    canvas = document.createElement('canvas')
    state.gyro_x = 0
    state.gyro_y = 0
    reset_motion_permission_state_for_tests()
    vi.stubGlobal('DeviceOrientationEvent', class {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const fire_orientation = (beta, gamma) => {
    const event = new Event('deviceorientation')
    Object.assign(event, { beta, gamma })
    window.dispatchEvent(event)
  }

  const flush_promises = async () => {
    await Promise.resolve()
    await Promise.resolve()
  }

  const request_permission_on_canvas_touch = async () => {
    canvas.dispatchEvent(new TouchEvent('touchend', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(10)
    await flush_promises()
  }

  it('enables without a gesture when no permission API exists', () => {
    Object.defineProperty(window, 'orientation', {
      configurable: true,
      value: 0
    })
    const dispose = bind_device_orientation({ canvas, state })
    fire_orientation(0, 0)
    fire_orientation(28, 0)

    expect(state.gyro_y).toBeCloseTo(-1, 1)

    dispose()
  })

  it('enables after ios motion permission is granted', async () => {
    const request_permission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal(
      'DeviceOrientationEvent',
      class {
        static requestPermission = request_permission
      }
    )
    Object.defineProperty(window, 'orientation', {
      configurable: true,
      value: 0
    })
    const dispose = bind_device_orientation({ canvas, state })
    await flush_promises()

    expect(request_permission).not.toHaveBeenCalled()
    expect(state.gyro_x).toBe(0)

    request_motion_permission()
    await flush_promises()
    fire_orientation(0, 0)
    fire_orientation(0, 28)

    expect(request_permission).toHaveBeenCalledTimes(1)
    expect(state.gyro_x).toBeCloseTo(1, 1)

    dispose()
  })

  it('requests permission on canvas touchend before enabling on ios', async () => {
    const request_permission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal(
      'DeviceOrientationEvent',
      class {
        static requestPermission = request_permission
      }
    )
    const dispose = bind_device_orientation({ canvas, state })

    await request_permission_on_canvas_touch()
    fire_orientation(0, 0)
    fire_orientation(0, 28)

    expect(request_permission).toHaveBeenCalledTimes(1)
    expect(state.gyro_x).toBeCloseTo(1, 1)

    dispose()
  })

  it('enables gyro after sync when ios motion permission is granted', async () => {
    const request_permission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal(
      'DeviceOrientationEvent',
      class {
        static requestPermission = request_permission
      }
    )
    const dispose = bind_device_orientation({ canvas, state })

    sync_motion_bindings()
    await request_permission_on_canvas_touch()
    fire_orientation(0, 0)
    fire_orientation(0, 28)

    expect(request_permission).toHaveBeenCalledTimes(1)
    expect(state.gyro_x).toBeCloseTo(1, 1)

    dispose()
  })

  it('publishes gyro debug snapshot when orientation events fire', async () => {
    const dispose = bind_device_orientation({ canvas, state })
    fire_orientation(0, 0)
    fire_orientation(0, 28)

    const snapshot = get_gyro_debug_snapshot()
    expect(snapshot.window_listeners).toBe(1)
    expect(snapshot.event_count).toBeGreaterThan(0)
    expect(snapshot.neutral_set).toBe(true)
    expect(snapshot.gyro_x).toBeCloseTo(1, 1)

    dispose()
    expect(get_gyro_debug_snapshot().window_listeners).toBe(0)
  })

  it('stays off when ios motion permission is denied', async () => {
    const request_permission = vi.fn().mockResolvedValue('denied')
    vi.stubGlobal(
      'DeviceOrientationEvent',
      class {
        static requestPermission = request_permission
      }
    )
    const dispose = bind_device_orientation({ canvas, state })

    await request_motion_permission()
    await flush_promises()
    fire_orientation(0, 0)
    fire_orientation(0, 28)

    expect(request_permission).toHaveBeenCalledTimes(1)
    expect(state.gyro_x).toBe(0)
    expect(state.gyro_y).toBe(0)
    expect(get_gyro_debug_snapshot().window_listeners).toBe(0)

    dispose()
  })
})
