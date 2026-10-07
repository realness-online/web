import { describe, it, expect } from 'vite-plus/test'
import { camera_travel, camera_bounds } from '@/use/poster-aspect'

const frame = { width: 400, height: 400 }

describe('@/use/poster-aspect camera_travel', () => {
  it('stays put at centre', () => {
    expect(camera_travel({ ...frame, viewbox: '0 0 400 1200', at: 0 })).toBe(0)
  })

  it('moves the same fraction of the frame on any poster', () => {
    const tall = camera_travel({ ...frame, viewbox: '0 0 400 1200', at: 0.1 })
    const taller = camera_travel({ ...frame, viewbox: '0 0 400 2400', at: 0.1 })
    expect(tall).toBe(taller)
  })

  it('stops a short poster at its own crop', () => {
    // 400x500 in a square frame crops 100 units, so the camera has 50 either way.
    expect(camera_travel({ ...frame, viewbox: '0 0 400 500', at: 1.5 })).toBe(
      50
    )
    expect(camera_travel({ ...frame, viewbox: '0 0 400 500', at: -1.5 })).toBe(
      -50
    )
  })

  it('takes more presses to cross a taller poster', () => {
    const step = 0.1
    const presses = viewbox => {
      let at = 0
      const limit = camera_travel({ ...frame, viewbox, at: 99 })
      while (camera_travel({ ...frame, viewbox, at }) < limit && at < 99)
        at += step
      return Math.round(at / step)
    }
    expect(presses('0 0 400 1200')).toBeGreaterThan(presses('0 0 400 500'))
  })

  it('has nothing to move when the poster fits', () => {
    expect(camera_travel({ ...frame, viewbox: '0 0 400 400', at: 1 })).toBe(0)
  })

  it('is zero without a viewbox or a rendered frame', () => {
    expect(camera_travel({ ...frame, viewbox: undefined, at: 1 })).toBe(0)
    expect(
      camera_travel({ width: 0, height: 0, viewbox: '0 0 400 1200', at: 1 })
    ).toBe(0)
  })
})

describe('@/use/poster-aspect camera_travel alignment', () => {
  // 400x800 in a 400x400 frame crops 400 units of the poster.
  const cropped = { ...frame, viewbox: '0 0 400 800' }

  it('splits the crop either way when centred', () => {
    expect(camera_travel({ ...cropped, at: 99 })).toBe(200)
    expect(camera_travel({ ...cropped, at: -99 })).toBe(-200)
  })

  it('has nowhere to go up from the top of the poster', () => {
    expect(camera_travel({ ...cropped, alignment: 'ymin', at: -99 })).toBe(0)
    expect(camera_travel({ ...cropped, alignment: 'ymin', at: 99 })).toBe(400)
  })

  it('has nowhere to go down from the bottom of the poster', () => {
    expect(camera_travel({ ...cropped, alignment: 'ymax', at: 99 })).toBe(0)
    expect(camera_travel({ ...cropped, alignment: 'ymax', at: -99 })).toBe(-400)
  })
})

describe('@/use/poster-aspect camera_bounds', () => {
  it('reports reach in frames, so posters can be compared', () => {
    // 400x800 in a 400x400 frame: 400 units cropped, 200 either way, one frame
    // being 400 units - so half a frame of travel each way.
    const bounds = camera_bounds({ ...frame, viewbox: '0 0 400 800' })
    expect(bounds).toEqual({ up: 0.5, down: 0.5, frame: 400 })
  })

  it('gives a taller poster more reach', () => {
    const tall = camera_bounds({ ...frame, viewbox: '0 0 400 1200' })
    const short = camera_bounds({ ...frame, viewbox: '0 0 400 500' })
    expect(tall.down).toBeGreaterThan(short.down)
  })

  it('has no reach for a poster that fits', () => {
    expect(camera_bounds({ ...frame, viewbox: '0 0 400 400' })).toEqual({
      up: 0,
      down: 0,
      frame: 400
    })
  })
})
