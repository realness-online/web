import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import {
  use_poster_svg_activate_pointer,
  LONG_PRESS_TOGGLE_MS,
  vibrate_long_press
} from '@/use/poster-svg-activate-pointer'

describe('@/use/poster-svg-activate-pointer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { vibrate: vi.fn() })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('mouse pointerup activates immediately', () => {
    const on_activate = vi.fn()
    const { handle_pointerdown, handle_pointerup } =
      use_poster_svg_activate_pointer({
        on_activate
      })

    handle_pointerdown({ pointerType: 'mouse', clientX: 0, clientY: 0 })
    handle_pointerup({ pointerType: 'mouse', clientX: 0, clientY: 0 })

    expect(on_activate).toHaveBeenCalledTimes(1)
  })

  it('touch long-press fires on_activate from timer', () => {
    const on_activate = vi.fn()
    const { handle_pointerdown } = use_poster_svg_activate_pointer({
      on_activate
    })

    handle_pointerdown({ pointerType: 'touch', clientX: 10, clientY: 10 })
    vi.advanceTimersByTime(LONG_PRESS_TOGGLE_MS)

    expect(on_activate).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalled()
  })

  it('touch slide cancels long-press before it fires', () => {
    const on_activate = vi.fn()
    const { handle_pointerdown, handle_pointermove, handle_pointerup } =
      use_poster_svg_activate_pointer({ on_activate })

    handle_pointerdown({ pointerType: 'touch', clientX: 0, clientY: 0 })
    handle_pointermove({ pointerType: 'touch', clientX: 30, clientY: 0 })
    vi.advanceTimersByTime(LONG_PRESS_TOGGLE_MS)
    handle_pointerup({ pointerType: 'touch', clientX: 30, clientY: 0 })

    expect(on_activate).not.toHaveBeenCalled()
  })

  it('pointerleave cancels pending long-press', () => {
    const on_activate = vi.fn()
    const { handle_pointerdown, handle_pointerleave } =
      use_poster_svg_activate_pointer({
        on_activate
      })

    handle_pointerdown({ pointerType: 'touch', clientX: 0, clientY: 0 })
    handle_pointerleave()
    vi.advanceTimersByTime(LONG_PRESS_TOGGLE_MS)

    expect(on_activate).not.toHaveBeenCalled()
  })

  it('vibrate_long_press swallows unsupported vibrate', () => {
    vi.stubGlobal('navigator', {})
    expect(() => vibrate_long_press()).not.toThrow()
  })
})
