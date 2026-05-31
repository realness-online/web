import { describe, it, expect, vi } from 'vite-plus/test'
import {
  INTERSECTION_THRESHOLDS,
  intersection_ratio,
  is_ratio_fully_visible,
  axis_visibility,
  measure_fully_visible,
  measure_visibility
} from '@/utils/intersection'

/** @param {Partial<DOMRectReadOnly>} overrides */
const rect = overrides => ({
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 400,
  bottom: 300,
  width: 400,
  height: 300,
  ...overrides
})

describe('@/utils/intersection', () => {
  it('exports 101 thresholds', () => {
    expect(INTERSECTION_THRESHOLDS).toHaveLength(101)
    expect(INTERSECTION_THRESHOLDS.at(-1)).toBe(1)
  })

  it('returns true when a tall element fills the viewport height', () => {
    const root = rect({ right: 800, bottom: 600, width: 800, height: 600 })
    const tall = rect({ right: 400, bottom: 1500, height: 1500 })

    expect(
      is_ratio_fully_visible(intersection_ratio(tall, root), tall, root)
    ).toBe(true)
  })

  it('returns false when only part of a tall element is visible', () => {
    const root = rect({ right: 800, bottom: 600, width: 800, height: 600 })
    const partial = rect({
      top: 400,
      bottom: 1900,
      y: 400,
      height: 1500
    })

    expect(
      is_ratio_fully_visible(intersection_ratio(partial, root), partial, root)
    ).toBe(false)
  })

  it('measure_fully_visible returns false without an element', () => {
    expect(measure_fully_visible(null)).toBe(false)
  })

  it('axis_visibility normalizes by what can fit in the root', () => {
    expect(axis_visibility(390, 512, 390)).toBe(1)
    expect(axis_visibility(200, 300, 390)).toBe(200 / 300)
    expect(axis_visibility(350, 512, 390)).toBe(350 / 390)
    expect(axis_visibility(0, 512, 390)).toBe(0)
  })

  it('measure_visibility reports in_view and fully_in_view from geometry', () => {
    const root = rect({ right: 800, bottom: 600, width: 800, height: 600 })
    const tall = rect({ right: 400, bottom: 1500, height: 1500 })
    const offscreen = rect({ top: 700, bottom: 1000, y: 700, height: 300 })

    vi.stubGlobal('innerWidth', root.width)
    vi.stubGlobal('innerHeight', root.height)

    /** @param {Partial<DOMRectReadOnly>} bounds */
    const element = bounds => ({
      getBoundingClientRect: () => rect(bounds)
    })

    expect(measure_visibility(null)).toEqual({
      in_view: false,
      fully_in_view: false
    })
    expect(measure_visibility(element(tall))).toEqual({
      in_view: true,
      fully_in_view: true
    })
    expect(measure_visibility(element(offscreen))).toEqual({
      in_view: false,
      fully_in_view: false
    })
  })
})
