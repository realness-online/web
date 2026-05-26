import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import {
  bind_ios_touch_menu_block,
  prevent_ios_touch_menu
} from '@/utils/block-ios-touch-menu.js'

describe('block-ios-touch-menu', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prevent_ios_touch_menu calls preventDefault', () => {
    const event = { preventDefault: vi.fn() }
    prevent_ios_touch_menu(/** @type {Event} */ (event))
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('bind_ios_touch_menu_block registers non-passive touchstart', () => {
    const canvas = document.createElement('canvas')
    const add_spy = vi.spyOn(canvas, 'addEventListener')
    const remove_spy = vi.spyOn(canvas, 'removeEventListener')

    const dispose = bind_ios_touch_menu_block(canvas)

    expect(add_spy).toHaveBeenCalledWith('touchstart', prevent_ios_touch_menu, {
      passive: false
    })

    dispose()

    expect(remove_spy).toHaveBeenCalledWith(
      'touchstart',
      prevent_ios_touch_menu
    )
  })
})
