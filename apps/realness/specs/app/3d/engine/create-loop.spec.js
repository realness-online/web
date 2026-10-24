import { vi } from 'vite-plus/test'
import { create_loop } from '@/3d/engine/create-loop.js'

describe('create_loop', () => {
  let raf_callback = null
  let raf_id = 0

  beforeEach(() => {
    raf_callback = null
    raf_id = 0
    vi.clearAllMocks()
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(callback => {
        raf_callback = callback
        raf_id += 1
        return raf_id
      })
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const tick_frames = (times_ms, loop) => {
    loop.start()
    for (const now_ms of times_ms) raf_callback(now_ms)
  }

  it('invokes tick with frame_state after start', () => {
    const tick = vi.fn()
    const loop = create_loop({ tick })
    tick_frames([1000, 1032], loop)

    expect(tick).toHaveBeenCalledTimes(2)
    expect(tick.mock.calls[0][0]).toMatchObject({
      now_ms: 1000,
      delta_s: 0,
      elapsed_s: 0
    })
    expect(tick.mock.calls[1][0].delta_s).toBeCloseTo(0.032, 3)
    expect(tick.mock.calls[1][0].elapsed_s).toBeCloseTo(0.032, 3)
  })

  it('caps delta to avoid spiral of death', () => {
    const tick = vi.fn()
    const loop = create_loop({ tick })
    tick_frames([1000, 6000], loop)

    expect(tick.mock.calls[1][0].delta_s).toBeCloseTo(1 / 15, 5)
  })

  it('stop prevents further ticks', () => {
    const tick = vi.fn()
    const loop = create_loop({ tick })
    loop.start()
    raf_callback(1000)
    loop.stop()
    raf_callback(2000)

    expect(tick).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  it('start is idempotent', () => {
    const tick = vi.fn()
    const loop = create_loop({ tick })
    loop.start()
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    loop.start()
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
  })
})
