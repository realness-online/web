import { describe, it, expect } from 'vite-plus/test'
import {
  frame_problem,
  poster_raster_size
} from '../../scripts/lib/poster-frame.js'

const png = 'data:image/png;base64,iVBORw0KGgo='

/** The shell a poster exports when its symbol defs never mounted. */
const empty_svg =
  '<svg viewBox="0 0 1214 512"><g>' +
  '<use itemprop="shadow" href="#driver-shadows-1785997142490"></use>' +
  '</g><defs></defs></svg>'

const traced_svg = empty_svg.replace('<defs>', '<defs><path d="M0 0h4v4z" />')

describe('scripts/lib/poster-frame', () => {
  it('keeps a frame that traced paths', () => {
    expect(frame_problem({ png, svg: traced_svg })).toBe(null)
  })

  it('rejects a well-formed poster that traced no paths', () => {
    expect(frame_problem({ png, svg: empty_svg })).toBe('traced no paths')
  })

  it('rejects a frame missing its png', () => {
    expect(frame_problem({ png: '', svg: traced_svg })).toBe(
      'produced no poster png'
    )
  })

  it('rejects a frame missing its svg', () => {
    expect(frame_problem({ png })).toBe('produced no poster svg')
  })

  it('rejects nothing at all', () => {
    expect(frame_problem()).toBe('produced no poster png')
  })
})

describe('poster_raster_size', () => {
  it('keeps the traced size when no width is asked for', () => {
    expect(poster_raster_size(traced_svg)).toEqual({
      width: 1214,
      height: 512
    })
  })

  it('scales a poster to 4k off the same viewBox', () => {
    expect(poster_raster_size(traced_svg, 3840)).toEqual({
      width: 3840,
      height: 1620
    })
  })

  it('rounds an odd height up, since yuv420p rejects odd dimensions', () => {
    // 1000 wide off 1214x512 lands on 421.7 - odd either way once rounded.
    const { width, height } = poster_raster_size(traced_svg, 1000)
    expect(width % 2).toBe(0)
    expect(height % 2).toBe(0)
  })

  it('rounds an odd requested width to even', () => {
    expect(poster_raster_size(traced_svg, 1921).width).toBe(1922)
  })

  it('returns null for an svg with no viewBox', () => {
    expect(poster_raster_size('<svg><path d="M0 0h1v1z" /></svg>')).toBe(null)
    expect(poster_raster_size('')).toBe(null)
    expect(poster_raster_size()).toBe(null)
  })
})
