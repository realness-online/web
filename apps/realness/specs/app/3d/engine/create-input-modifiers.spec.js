import { vi } from 'vite-plus/test'
import { create_input } from '@/3d/engine/create-input.js'

vi.mock('@/3d/engine/bind-device-orientation.js', () => ({
  bind_device_orientation: vi.fn(() => () => {})
}))

describe('create_input listeners and modifiers', () => {
  let canvas
  let input

  const pointer = (type, options = {}) =>
    canvas.dispatchEvent(
      new PointerEvent(type, {
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
        ...options
      })
    )
  const wheel = (options = {}) => {
    const event = new WheelEvent('wheel', { cancelable: true, ...options })
    canvas.dispatchEvent(event)
    return event
  }
  const key = (type, value) =>
    window.dispatchEvent(
      new KeyboardEvent(type, { key: value, cancelable: true })
    )

  beforeEach(() => {
    canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 200
    })
    canvas.setPointerCapture = vi.fn()
    canvas.releasePointerCapture = vi.fn()
    input = create_input({ canvas })
  })

  afterEach(() => {
    input.dispose()
    canvas.remove()
  })

  it('clamps the pointer target to the surface when it leaves the box', () => {
    pointer('pointermove', { clientX: -50, clientY: 400 })
    expect(input.state.pointer_x_norm).toBe(-1)
    expect(input.state.pointer_y_norm).toBe(1)
    pointer('pointermove', { clientX: 900, clientY: -900 })
    expect(input.state.pointer_x_norm).toBe(1)
    expect(input.state.pointer_y_norm).toBe(-1)
  })

  it('pans on both wheel axes while Alt is held', () => {
    key('keydown', 'Alt')
    wheel({ deltaY: 12 })
    expect(input.state.pan_wheel_y).toBe(12)
    expect(input.state.pan_wheel_x).toBe(0)
    wheel({ deltaY: 0, deltaX: 7 })
    expect(input.state.pan_wheel_y).toBe(19)
    key('keyup', 'Alt')
    wheel({ deltaY: 5 })
    expect(input.state.pan_wheel_y).toBe(19)
  })

  it('zooms on the wheel while Meta is held, and not otherwise', () => {
    wheel({ deltaY: 40 })
    expect(input.state.wheel_delta).toBe(0)
    key('keydown', 'Meta')
    wheel({ deltaY: 40 })
    expect(input.state.wheel_delta).toBe(40)
    key('keyup', 'Meta')
    wheel({ deltaY: 40 })
    expect(input.state.wheel_delta).toBe(40)
  })

  it('pans on the horizontal axis while Shift is held, before Alt is read', () => {
    key('keydown', 'Shift')
    key('keydown', 'Alt')
    wheel({ deltaY: 30 })
    expect(input.state.pan_wheel_x).toBe(30)
    expect(input.state.pan_wheel_y).toBe(0)
  })

  it('adds opposing arrow keys and ignores other keys', () => {
    key('keydown', 'ArrowLeft')
    key('keydown', 'ArrowRight')
    expect([input.state.arrow_x, input.state.arrow_y]).toEqual([0, 0])
    key('keyup', 'ArrowLeft')
    expect(input.state.arrow_x).toBe(1)
    key('keydown', 'ArrowUp')
    key('keydown', 'ArrowDown')
    expect(input.state.arrow_y).toBe(0)
    key('keyup', 'ArrowUp')
    expect(input.state.arrow_y).toBe(-1)
    key('keydown', 'a')
    expect([input.state.arrow_x, input.state.arrow_y]).toEqual([1, -1])
  })

  it('clears every held modifier and arrow when the window loses focus', () => {
    key('keydown', 'Shift')
    key('keydown', 'Alt')
    key('keydown', 'Meta')
    key('keydown', 'ArrowUp')
    pointer('pointermove')
    window.dispatchEvent(new Event('blur'))
    expect([
      input.state.shift_held,
      input.state.alt_held,
      input.state.cmd_held,
      input.state.arrow_y,
      input.state.pointer_x_norm
    ]).toEqual([false, false, false, 0, 0])
  })

  it('reset_frame_deltas clears every frame delta', () => {
    pointer('pointerdown', { pointerId: 1 })
    pointer('pointermove', { pointerId: 1, clientX: 40, clientY: 50 })
    key('keydown', 'Meta')
    wheel({ deltaY: 10 })
    input.reset_frame_deltas()
    expect([
      input.state.pointer_dx,
      input.state.pointer_dy,
      input.state.wheel_delta,
      input.state.pan_wheel_x,
      input.state.pan_wheel_y
    ]).toEqual([0, 0, 0, 0, 0])
  })

  it('leaves a touch pointer alone when a different pointer lifts', () => {
    pointer('pointerdown', { pointerType: 'touch', pointerId: 7 })
    expect(input.state.touch_active).toBe(true)
    pointer('pointerup', { pointerType: 'touch', pointerId: 9 })
    expect(input.state.touch_active).toBe(true)
    pointer('pointerup', { pointerType: 'touch', pointerId: 7 })
    expect(input.state.touch_active).toBe(false)
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7)
    pointer('pointercancel', { pointerType: 'touch', pointerId: 7 })
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7)
  })

  it('does nothing on a mouse leave while a touch drag is active', () => {
    pointer('pointerleave', { pointerType: 'touch' })
    expect(input.state.pointer_x_norm).toBe(0)
  })

  it('takes pointer capture on pointer down', () => {
    pointer('pointerdown', { pointerId: 3 })
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(3)
  })
})
