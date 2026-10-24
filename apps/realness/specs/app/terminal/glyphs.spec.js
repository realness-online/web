import { describe, expect, it } from 'vite-plus/test'
import { draw_glyph } from '@/terminal/glyphs'
import { draw_frame } from '@/terminal/render-canvas'

const recorder = () => {
  const rects = []
  return {
    rects,
    fillRect: (x, y, w, h) => rects.push([x, y, w, h])
  }
}

const covers = (rects, x, y) =>
  rects.some(
    ([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh
  )

describe('terminal glyph shapes', () => {
  it('a vertical line spans the full cell height so rows join', () => {
    const ctx = recorder()
    expect(
      draw_glyph(ctx, '│', { x: 0, y: 0, w: 8, h: 20, font_size: 14 })
    ).toBe(true)
    expect(covers(ctx.rects, 3, 0)).toBe(true)
    expect(covers(ctx.rects, 3, 19)).toBe(true)
  })

  it('rounded corners reach the two edges they connect', () => {
    const ctx = recorder()
    draw_glyph(ctx, '╭', { x: 0, y: 0, w: 8, h: 20, font_size: 14 })
    expect(covers(ctx.rects, 7, 9)).toBe(true)
    expect(covers(ctx.rects, 3, 19)).toBe(true)
    expect(covers(ctx.rects, 3, 0)).toBe(false)
    expect(covers(ctx.rects, 0, 9)).toBe(false)
  })

  it('lower blocks fill eighths of the height from the bottom', () => {
    const ctx = recorder()
    draw_glyph(ctx, '▁', { x: 0, y: 0, w: 8, h: 16, font_size: 14 })
    expect(ctx.rects).toEqual([[0, 14, 8, 2]])
    const full = recorder()
    draw_glyph(full, '█', { x: 0, y: 0, w: 8, h: 16, font_size: 14 })
    expect(full.rects).toEqual([[0, 0, 8, 16]])
  })

  it('left blocks fill eighths of the width', () => {
    const ctx = recorder()
    draw_glyph(ctx, '▌', { x: 0, y: 0, w: 8, h: 16, font_size: 14 })
    expect(ctx.rects).toEqual([[0, 0, 4, 16]])
  })

  it('braille dots spread over all four rows of the cell', () => {
    const ctx = recorder()
    draw_glyph(ctx, '\u28ff', { x: 0, y: 0, w: 8, h: 20, font_size: 14 })
    expect(ctx.rects).toHaveLength(8)
    const rows = new Set(ctx.rects.map(([, y]) => y))
    expect(rows.size).toBe(4)
    expect(Math.min(...rows)).toBeLessThan(5)
    expect(Math.max(...rows)).toBeGreaterThan(15)
    const blank = recorder()
    expect(
      draw_glyph(blank, '\u2800', { x: 0, y: 0, w: 8, h: 20, font_size: 14 })
    ).toBe(true)
    expect(blank.rects).toEqual([])
  })

  it('other text falls through to the font', () => {
    expect(
      draw_glyph(recorder(), 'a', { x: 0, y: 0, w: 8, h: 20, font_size: 14 })
    ).toBe(false)
    expect(
      draw_glyph(recorder(), '●', { x: 0, y: 0, w: 8, h: 20, font_size: 14 })
    ).toBe(false)
  })

  it('the frame draws shapes instead of font text for these cells', () => {
    const texts = []
    const ctx = {
      canvas: { width: 0, height: 0, style: {} },
      measureText: () => ({ width: 8 }),
      setTransform() {},
      fillRect() {},
      fillText: text => texts.push(text),
      set fillStyle(v) {},
      set font(v) {},
      set textBaseline(v) {}
    }
    draw_frame(
      ctx,
      {
        cols: 3,
        rows: 1,
        colors: { background: [0, 0, 0], foreground: [9, 9, 9] },
        rows_data: [{ cells: [{ text: '│' }, { text: 'a' }, { text: '█' }] }],
        cursor: { visible: false }
      },
      { dpr: 1 }
    )
    expect(texts).toEqual(['a'])
  })
})
