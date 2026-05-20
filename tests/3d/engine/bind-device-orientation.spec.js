import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { bind_device_orientation } from '@/3d/engine/bind-device-orientation.js'

describe('bind_device_orientation', () => {
  /** @type {HTMLCanvasElement} */
  let canvas
  const state = { gyro_x: 0, gyro_y: 0 }

  beforeEach(() => {
    canvas = document.createElement('canvas')
    state.gyro_x = 0
    state.gyro_y = 0
    vi.stubGlobal('DeviceOrientationEvent', class {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const fire_orientation = (beta, gamma) => {
    const event = new Event('deviceorientation')
    Object.assign(event, { beta, gamma })
    window.dispatchEvent(event)
  }

  it('first orientation event calibrates neutral without moving state', () => {
    const dispose = bind_device_orientation({ canvas, state })
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    fire_orientation(10, 5)

    expect(state.gyro_x).toBe(0)
    expect(state.gyro_y).toBe(0)

    dispose()
  })

  it('maps portrait deltas into clamped gyro state', () => {
    Object.defineProperty(window, 'orientation', {
      configurable: true,
      value: 0
    })
    const dispose = bind_device_orientation({ canvas, state })
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    fire_orientation(0, 0)
    fire_orientation(28, 0)

    expect(state.gyro_y).toBeCloseTo(-1, 1)

    dispose()
  })

  it('dispose removes listeners and zeros gyro', () => {
    const add_spy = vi.spyOn(window, 'addEventListener')
    const remove_spy = vi.spyOn(window, 'removeEventListener')
    const dispose = bind_device_orientation({ canvas, state })
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    state.gyro_x = 0.5
    state.gyro_y = -0.5
    dispose()

    expect(state.gyro_x).toBe(0)
    expect(state.gyro_y).toBe(0)
    expect(remove_spy).toHaveBeenCalledWith(
      'deviceorientation',
      expect.any(Function)
    )
    add_spy.mockRestore()
    remove_spy.mockRestore()
  })

  it('recalibrates neutral on orientationchange for the next delta', () => {
    const dispose = bind_device_orientation({ canvas, state })
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    fire_orientation(0, 0)
    fire_orientation(20, 0)
    const before_change = state.gyro_y

    window.dispatchEvent(new Event('orientationchange'))
    fire_orientation(40, 0)
    fire_orientation(42, 0)

    expect(before_change).not.toBe(0)
    expect(Math.abs(state.gyro_y)).toBeLessThan(0.15)

    dispose()
  })
})
