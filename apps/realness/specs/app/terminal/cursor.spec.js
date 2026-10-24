import { describe, expect, it } from 'vite-plus/test'
import { draw_frame } from '@/terminal/render-canvas'

const fake_ctx = () => {
  const calls = []
  return {
    calls,
    canvas: { width: 0, height: 0, style: {} },
    measureText: () => ({ width: 8 }),
    setTransform() {},
    fillRect: (...args) => calls.push(['fill', ...args]),
    strokeRect: (...args) => calls.push(['stroke', ...args]),
    fillText() {},
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set font(v) {},
    set textBaseline(v) {},
    set globalAlpha(v) {}
  }
}

const frame = {
  cols: 2,
  rows: 1,
  colors: { background: [0, 0, 0], foreground: [9, 9, 9], cursor: [1, 2, 3] },
  rows_data: [{ cells: [{}, {}] }],
  cursor: {
    visible: true,
    viewport_has_value: true,
    x: 1,
    y: 0,
    visual_style: 1,
    blinking: false
  }
}

const cursor_calls = ctx => ctx.calls.filter(([, x]) => x >= 8)

describe('terminal cursor', () => {
  it('blinks a solid cursor while focused, even when the app asks for steady', () => {
    const on = fake_ctx()
    draw_frame(on, frame, { dpr: 1, focused: true, blink_on: true })
    expect(cursor_calls(on).map(([kind]) => kind)).toEqual(['fill'])
    const off = fake_ctx()
    draw_frame(off, frame, { dpr: 1, focused: true, blink_on: false })
    expect(cursor_calls(off)).toEqual([])
  })

  it('shows a steady hollow box when the terminal is not focused', () => {
    for (const blink_on of [true, false]) {
      const ctx = fake_ctx()
      draw_frame(ctx, frame, { dpr: 1, focused: false, blink_on })
      expect(cursor_calls(ctx).map(([kind]) => kind)).toEqual(['stroke'])
    }
  })
})
