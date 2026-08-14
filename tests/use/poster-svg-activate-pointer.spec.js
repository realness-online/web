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

  it('is_disabled skips activation', () => {
    const on_activate = vi.fn()
    const { handle_pointerdown, handle_pointerup } =
      use_poster_svg_activate_pointer({
        on_activate,
        is_disabled: true
      })

    handle_pointerdown({ pointerType: 'mouse', clientX: 0, clientY: 0 })
    handle_pointerup({ pointerType: 'mouse', clientX: 0, clientY: 0 })

    expect(on_activate).not.toHaveBeenCalled()
  })

  it('contextmenu is prevented after a touch, left alone after a mouse', () => {
    const { handle_pointerdown, handle_contextmenu } =
      use_poster_svg_activate_pointer({ on_activate: vi.fn() })

    handle_pointerdown({ pointerType: 'touch', clientX: 0, clientY: 0 })
    const callout = { preventDefault: vi.fn() }
    handle_contextmenu(callout)
    expect(callout.preventDefault).toHaveBeenCalled()

    handle_pointerdown({ pointerType: 'mouse', clientX: 0, clientY: 0 })
    const right_click = { preventDefault: vi.fn() }
    handle_contextmenu(right_click)
    expect(right_click.preventDefault).not.toHaveBeenCalled()
  })

  it('contextmenu still blocks the touch callout while disabled', () => {
    const { handle_pointerdown, handle_contextmenu } =
      use_poster_svg_activate_pointer({
        on_activate: vi.fn(),
        is_disabled: true
      })

    handle_pointerdown({ pointerType: 'touch', clientX: 0, clientY: 0 })
    const callout = { preventDefault: vi.fn() }
    handle_contextmenu(callout)
    expect(callout.preventDefault).toHaveBeenCalled()
  })

  it('vibrate_long_press swallows unsupported vibrate', () => {
    vi.stubGlobal('navigator', {})
    expect(() => vibrate_long_press()).not.toThrow()
  })

  it('vibrate_long_press clicks a switch label (Safari haptic)', () => {
    /** @type {HTMLElement[]} */
    const clicked = []
    const original = HTMLElement.prototype.click
    HTMLElement.prototype.click = function () {
      clicked.push(this)
    }

    vibrate_long_press()

    HTMLElement.prototype.click = original

    expect(clicked.length).toBe(1)
    const label = clicked[0]
    expect(label.tagName).toBe('LABEL')
    const input = label.querySelector('input[type="checkbox"][switch]')
    expect(input).toBeTruthy()
    // The label drives the input, and the input keeps its native appearance
    expect(label.htmlFor).toBe(input.id)
    expect(input.style.appearance).toBe('auto')

    // One element, reused
    vibrate_long_press()
    expect(document.querySelectorAll('input[switch]').length).toBe(1)
  })
})
