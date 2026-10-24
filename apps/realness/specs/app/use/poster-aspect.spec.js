import { describe, it, expect } from 'vite-plus/test'
import {
  slice_preserve_aspect_ratio,
  poster_landscape,
  poster_ratio,
  poster_preserve_aspect_ratio
} from '@/use/poster-aspect'

describe('@/use/poster-aspect', () => {
  it('slice_preserve_aspect_ratio respects alignment', () => {
    expect(slice_preserve_aspect_ratio('ymid')).toBe('xMidYMid slice')
    expect(slice_preserve_aspect_ratio('ymin')).toBe('xMidYMin slice')
    expect(slice_preserve_aspect_ratio('ymax')).toBe('xMidYMax slice')
  })

  it('poster_landscape compares viewbox width and height', () => {
    expect(poster_landscape('0 0 400 200')).toBe(true)
    expect(poster_landscape('0 0 200 400')).toBe(false)
    expect(poster_landscape(undefined)).toBe(false)
  })

  it('poster_ratio divides viewbox width by height', () => {
    expect(poster_ratio('0 0 683 512')).toBeCloseTo(1.334, 3)
    expect(poster_ratio('0 0 512 683')).toBeCloseTo(0.75, 3)
    expect(poster_ratio('0 0 512 512')).toBe(1)
  })

  it('poster_ratio falls back to square', () => {
    expect(poster_ratio(undefined)).toBe(1)
    expect(poster_ratio('0 0 512 0')).toBe(1)
  })

  it('poster_preserve_aspect_ratio prefers meet when asked', () => {
    expect(poster_preserve_aspect_ratio({ meet: true, mode: '16/9' })).toBe(
      'xMidYMid meet'
    )
  })

  it('poster_preserve_aspect_ratio slices when mode is set', () => {
    expect(
      poster_preserve_aspect_ratio({ mode: '16/9', alignment: 'ymin' })
    ).toBe('xMidYMin slice')
  })

  it('poster_preserve_aspect_ratio defaults to meet', () => {
    expect(poster_preserve_aspect_ratio()).toBe('xMidYMid meet')
    expect(poster_preserve_aspect_ratio({ mode: 'auto' })).toBe('xMidYMid meet')
  })
})
