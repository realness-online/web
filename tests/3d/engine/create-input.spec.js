import { vi } from 'vite-plus/test'
import { create_input } from '@/3d/engine/create-input.js'

vi.mock('@/3d/engine/bind-device-orientation.js', () => ({
  bind_device_orientation: vi.fn(() => () => {})
}))

describe('create_input', () => {
  it('tracks pointer drag and wheel pan when shift is held', () => {
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 100, height: 100 })
    })
    canvas.setPointerCapture = vi.fn()
    canvas.releasePointerCapture = vi.fn()

    const input = create_input({ canvas })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        bubbles: true
      })
    )
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 30,
        clientY: 20,
        pointerId: 1,
        bubbles: true
      })
    )
    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        deltaX: 5,
        deltaY: 0,
        bubbles: true,
        cancelable: true
      })
    )

    expect(input.state.pointer_dx).not.toBe(0)
    expect(input.state.pan_wheel_x).not.toBe(0)

    input.reset_frame_deltas()
    expect(input.state.pointer_dx).toBe(0)
    expect(input.state.pan_wheel_x).toBe(0)

    input.dispose()
    canvas.remove()
  })

  it('dispose removes window and canvas listeners', () => {
    const canvas = document.createElement('canvas')
    const keydown_spy = vi.spyOn(window, 'addEventListener')
    const keydown_remove = vi.spyOn(window, 'removeEventListener')

    const input = create_input({ canvas })
    input.dispose()

    expect(keydown_remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(keydown_remove).toHaveBeenCalledWith('keyup', expect.any(Function))
    expect(keydown_remove).toHaveBeenCalledWith('blur', expect.any(Function))

    keydown_spy.mockRestore()
    keydown_remove.mockRestore()
  })
})
