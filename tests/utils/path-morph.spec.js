import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  as_contours,
  as_key_times,
  breathing_order,
  normalize_set
} from '@/utils/path-morph'

const poster_layers = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../mocks/html/poster-layers.html'
  ),
  'utf8'
)

// Parsed rather than matched: `vp fmt` reflows the fixture's attributes.
// text/html, not svg+xml - bare `itemscope` is not well-formed XML.
const fixture = new DOMParser().parseFromString(poster_layers, 'text/html')

/** @param {string} name */
const layer = name =>
  fixture.querySelector(`[itemprop="${name}"]`).getAttribute('d')

const layers = ['light', 'regular', 'medium', 'bold'].map(layer)

// A denser poster, 61/44/47/66 contours. Its bold layer paints the top of the
// frame with many small marks, which is what caught the contour cap dropping
// visible geometry.
const dense_fixture = new DOMParser().parseFromString(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../mocks/html/poster-layers-dense.html'
    ),
    'utf8'
  ),
  'text/html'
)

/** @param {string} name */
const dense_layer = name =>
  dense_fixture.querySelector(`[itemprop="${name}"]`).getAttribute('d')

const dense_layers = ['light', 'regular', 'medium', 'bold'].map(dense_layer)

/** The command letters in order - what SVG compares before interpolating */
const signature = d => (d.match(/[A-Za-z]/g) || []).join('')

/** A slot filled by padding rather than a real shape */
const is_collapsed = contour =>
  contour.cubics.every(
    cubic =>
      Math.hypot(cubic[4] - contour.start[0], cubic[5] - contour.start[1]) <
      1e-6
  )

/**
 * Endpoint extremes. Curve bulge is ignored; it is the same on both sides.
 * @param {string} d
 * @param {boolean} [solid_only] Skip padded slots, which sit where the fuller
 *   layer put that shape and so can fall outside this layer's own extent
 */
const bounds = (d, solid_only = false) => {
  const contours = as_contours(d).filter(
    contour => !solid_only || !is_collapsed(contour)
  )
  const points = contours.flatMap(contour => [
    contour.start,
    ...contour.cubics.map(cubic => [cubic[4], cubic[5]])
  ])
  return {
    left: Math.min(...points.map(point => point[0])),
    top: Math.min(...points.map(point => point[1])),
    right: Math.max(...points.map(point => point[0])),
    bottom: Math.max(...points.map(point => point[1]))
  }
}

/** Where a normalized contour's segment boundaries land */
const corners = (d, index = 0) => {
  const contour = as_contours(d)[index]
  return [contour.start, ...contour.cubics.map(cubic => [cubic[4], cubic[5]])]
}

const circle = (cx, cy, r, from = 0) => {
  const steps = 24
  const at = i => {
    const angle = from + (i / steps) * 2 * Math.PI
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }
  let d = `M${at(0)[0]} ${at(0)[1]}`
  for (let i = 1; i <= steps; i++) d += `L${at(i)[0]} ${at(i)[1]}`
  return `${d}Z`
}

describe('as_contours', () => {
  it('reads potrace output, which is absolute M C L', () => {
    const contours = as_contours('M0 0C0 0 10 0 10 0L10 10 0 10Z')
    expect(contours).toHaveLength(1)
    expect(contours[0].start).toEqual([0, 0])
    expect(contours[0].cubics.every(cubic => cubic.length === 6)).toBe(true)
  })

  it('reads the relative commands svgo leaves on archived posters', () => {
    const absolute = as_contours('M10 10L20 10L20 20L10 20Z')
    const relative = as_contours('m10 10l10 0l0 10l-10 0z')
    expect(relative[0].start).toEqual(absolute[0].start)
    expect(relative[0].cubics.at(-1)).toEqual(absolute[0].cubics.at(-1))
  })

  it('reads horizontal and vertical shorthands', () => {
    const contours = as_contours('M0 0H10V10H0Z')
    const ends = contours[0].cubics.map(cubic => [cubic[4], cubic[5]])
    expect(ends).toContainEqual([10, 0])
    expect(ends).toContainEqual([10, 10])
    expect(ends).toContainEqual([0, 10])
  })

  it('converts arcs, which svgo makeArcs puts in poster data', () => {
    // Chrome reports this semicircle as x 0 y -50 w 100 h 50. The conversion
    // breaks at quarter turns, so the apex lands on a segment boundary.
    const box = bounds('M0 0A50 50 0 0 1 100 0Z')
    expect(box.left).toBeCloseTo(0, 1)
    expect(box.right).toBeCloseTo(100, 1)
    expect(box.top).toBeCloseTo(-50, 1)
  })

  it('converts quadratics and their smooth continuation', () => {
    // Peaks live in the control points, not the endpoints, so read those.
    const [contour] = as_contours('M0 0Q50 100 100 0T200 0Z')
    const control_y = contour.cubics.flatMap(cubic => [cubic[1], cubic[3]])
    expect(Math.max(...control_y)).toBeGreaterThan(0)
    // T mirrors the previous control, so the second hump goes the other way
    expect(Math.min(...control_y)).toBeLessThan(0)
  })

  it('closes a contour potrace left open', () => {
    const [contour] = as_contours('M0 0C0 0 10 0 10 0C10 0 10 10 10 10')
    expect(contour.cubics.at(-1).slice(4)).toEqual(contour.start)
  })

  it('splits a path into one contour per subpath', () => {
    expect(as_contours(layer('medium'))).toHaveLength(32)
    expect(as_contours(layer('light'))).toHaveLength(15)
  })
})

describe('normalize_set', () => {
  it('gives every layer one command signature, which is what SVG needs', () => {
    const normalized = normalize_set(layers, { contours: 12, segments: 8 })
    const signatures = new Set(normalized.map(signature))
    expect(signatures.size).toBe(1)
  })

  it('emits M, a fixed run of C, then Z per contour', () => {
    const [normalized] = normalize_set(layers, { contours: 3, segments: 5 })
    expect(signature(normalized)).toBe('MCCCCCZ'.repeat(3))
  })

  it('keeps the largest shapes when a layer has more than the limit', () => {
    const [normalized] = normalize_set(layers, { contours: 4, segments: 6 })
    expect(as_contours(normalized)).toHaveLength(4)
  })

  it('pads a thin layer up to the fullest one', () => {
    const normalized = normalize_set(layers, { contours: 40, segments: 6 })
    const counts = normalized.map(d => as_contours(d).length)
    expect(new Set(counts).size).toBe(1)
    expect(counts[0]).toBe(32)
  })

  it('collapses a padded slot onto a point rather than the origin', () => {
    // light carries 15 shapes against medium's 32, so 17 of its slots are
    // padding. Which slots those are depends on pairing, so look for them.
    const [light] = normalize_set(layers, { contours: 40, segments: 6 })
    const collapsed = as_contours(light).filter(contour =>
      contour.cubics.every(
        cubic =>
          Math.hypot(cubic[4] - contour.start[0], cubic[5] - contour.start[1]) <
          1e-6
      )
    )
    expect(collapsed).toHaveLength(32 - 15)
    // Each sits where the fuller layer put that shape, not at the origin
    for (const contour of collapsed)
      expect(Math.hypot(contour.start[0], contour.start[1])).toBeGreaterThan(0)
  })

  it('holds each layer close to the bounds it arrived with', () => {
    // Resampling walks by arc length, so an extreme vertex can fall between
    // samples. The drift is a fraction of a percent, not a shifted shape.
    // Padded slots are excluded - they sit where the fullest layer put that
    // shape, which is the point of them, and can land outside this layer.
    const normalized = normalize_set(layers, { contours: 40, segments: 36 })
    for (const [index, before] of layers.map(d => bounds(d)).entries()) {
      const after = bounds(normalized[index], true)
      const width = before.right - before.left
      const height = before.bottom - before.top
      expect(Math.abs(after.left - before.left)).toBeLessThan(width * 0.03)
      expect(Math.abs(after.right - before.right)).toBeLessThan(width * 0.03)
      expect(Math.abs(after.top - before.top)).toBeLessThan(height * 0.03)
      expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(height * 0.03)
    }
  })

  it('keeps every layer covering the frame it started with', () => {
    // The contour cap ranks by area, and a layer can paint a whole region with
    // many small marks - this poster's bold layer does exactly that across the
    // top. Capping it away left the layer morphing into the bottom third only,
    // which on screen reads as a poster borrowing another one's shape.
    const normalized = normalize_set(dense_layers)
    for (const [index, before] of dense_layers.map(d => bounds(d)).entries()) {
      const after = bounds(normalized[index], true)
      const height = before.bottom - before.top
      expect(Math.abs(after.top - before.top)).toBeLessThan(height * 0.05)
      expect(Math.abs(after.bottom - before.bottom)).toBeLessThan(height * 0.05)
    }
  })

  it('rounds to the precision asked for', () => {
    const [normalized] = normalize_set(layers, {
      contours: 2,
      segments: 4,
      precision: 0
    })
    expect(normalized).not.toMatch(/\d\.\d/)
  })

  it('survives a layer with nothing in it', () => {
    const normalized = normalize_set([layer('bold'), ''], {
      contours: 4,
      segments: 6
    })
    expect(new Set(normalized.map(signature)).size).toBe(1)
  })

  it('returns empty paths when no layer has a shape', () => {
    expect(normalize_set(['', ''])).toEqual(['', ''])
  })

  it('aligns start vertices so matching shapes do not twist', () => {
    // The same circle, written starting half a turn apart. Without alignment
    // the two normalized paths pair each point with its opposite, and the
    // morph between them collapses through the centre.
    const half_turn = [circle(200, 200, 100, 0), circle(200, 200, 100, Math.PI)]
    const [first, second] = normalize_set(half_turn, {
      contours: 1,
      segments: 24
    })

    const drift = corners(first).map((point, index) =>
      Math.hypot(
        point[0] - corners(second)[index][0],
        point[1] - corners(second)[index][1]
      )
    )
    // Unaligned, corresponding points sit a diameter apart - 200 here
    expect(Math.max(...drift)).toBeLessThan(20)
  })

  it('winds every contour the same way', () => {
    // Same square, drawn clockwise and counter-clockwise
    const clockwise = 'M0 0L100 0L100 100L0 100Z'
    const counter = 'M0 0L0 100L100 100L100 0Z'
    const [first, second] = normalize_set([clockwise, counter], {
      contours: 1,
      segments: 8
    })
    const turn = d => {
      const points = corners(d)
      let total = 0
      for (let i = 0; i < points.length - 1; i++)
        total +=
          points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1]
      return Math.sign(total)
    }
    expect(turn(first)).toBe(turn(second))
  })

  it('pairs by position, not by area rank', () => {
    // Two layers, two shapes each. Area rank swaps them because the big shape
    // moves side to side; position keeps each mapped to the one it overlaps.
    const left_big = `${circle(100, 100, 60)}${circle(400, 100, 20)}`
    const right_big = `${circle(100, 100, 22)}${circle(400, 100, 58)}`

    const by_position = normalize_set([left_big, right_big], {
      contours: 2,
      segments: 8,
      pairing: 'position'
    })
    const by_area = normalize_set([left_big, right_big], {
      contours: 2,
      segments: 8,
      pairing: 'area'
    })

    const first_slot_x = d => as_contours(d)[0].start[0]
    // Position keeps slot one on the left in both layers
    expect(
      Math.abs(first_slot_x(by_position[0]) - first_slot_x(by_position[1]))
    ).toBeLessThan(100)
    // Area rank puts the big shape first, so slot one jumps across
    expect(
      Math.abs(first_slot_x(by_area[0]) - first_slot_x(by_area[1]))
    ).toBeGreaterThan(200)
  })
})

describe('breathing_order', () => {
  it('pairs a layer with the next density', () => {
    expect(breathing_order(0, 4)).toEqual([0, 1, 0])
    expect(breathing_order(2, 4)).toEqual([2, 3, 2])
  })

  it('pairs the last layer backwards, so nothing wraps', () => {
    expect(breathing_order(3, 4)).toEqual([3, 2, 3])
  })

  it('stays put when there is only one layer', () => {
    expect(breathing_order(0, 1)).toEqual([0])
  })
})

describe('as_key_times', () => {
  it('spreads frames evenly across the timeline', () => {
    expect(as_key_times(3)).toBe('0;0.5;1')
    expect(as_key_times(5)).toBe('0;0.25;0.5;0.75;1')
  })
  it('reserves a hold on the last frame', () => {
    expect(as_key_times(4, 1 / 3)).toBe('0;0.3333;0.6667;1')
    expect(as_key_times(4, 0.2)).toBe('0;0.4;0.8;1')
  })
})
