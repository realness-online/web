import { vi } from 'vite-plus/test'
import { create_resize_observer } from '@/3d/engine/create-resize-observer.js'

describe('create_resize_observer', () => {
  let resize_callback = null

  beforeEach(() => {
    resize_callback = null
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function (callback) {
        resize_callback = callback
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn()
        }
      })
    )
    vi.stubGlobal('devicePixelRatio', 2)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sync_now reports canvas size capped pixel ratio', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({
      width: 200.7,
      height: 100.2,
      left: 0,
      top: 0
    })
    const on_resize = vi.fn()
    const observer = create_resize_observer({ canvas, on_resize })

    observer.sync_now()

    expect(on_resize).toHaveBeenCalledWith({
      width: 200,
      height: 100,
      pixel_ratio: 2
    })
  })

  it('start observes canvas and syncs immediately', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({
      width: 10,
      height: 10,
      left: 0,
      top: 0
    })
    const on_resize = vi.fn()
    const observer = create_resize_observer({ canvas, on_resize })

    observer.start()

    expect(ResizeObserver).toHaveBeenCalled()
    expect(on_resize).toHaveBeenCalledTimes(1)
    resize_callback()
    expect(on_resize).toHaveBeenCalledTimes(2)
  })

  it('stop disconnects observer', () => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({
      width: 1,
      height: 1,
      left: 0,
      top: 0
    })
    const observer = create_resize_observer({
      canvas,
      on_resize: vi.fn()
    })
    observer.start()
    const instance = ResizeObserver.mock.results[0].value
    observer.stop()
    expect(instance.disconnect).toHaveBeenCalled()
  })
})
