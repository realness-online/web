import { wasm_bytes } from './wasm.js'
import { load_engine } from '../../../src/app/terminal/ghostty-vt.js'

const engine = await load_engine(wasm_bytes)

const filled = () => {
  const term = engine.terminal(40, 10)
  const lines = Array.from(
    { length: 30 },
    (_, i) => `line ${String(i).padStart(2, '0')} content`
  )
  term.write(`${lines.join('\r\n')}\r\n`)
  return term
}

describe('selection and scrollback', () => {
  it('selects a range and everything', () => {
    const term = filled()
    const first_row = term.screen_text().split('\n')[0]
    term.select_range(0, 0, 4, 0)
    expect(term.selection_text()).toBe(first_row.slice(0, 5))
    term.select_all()
    expect(term.selection_text()).toContain('line 29 content')
  })

  it('reports the scrollbar at the bottom', () => {
    const bar = filled().scrollbar()
    expect(bar.total).toBeGreaterThan(10)
    expect(bar.len).toBe(10)
    expect(bar.offset).toBe(bar.total - bar.len)
  })

  it('scrolls back, returns, and clears scrollback', () => {
    const term = filled()
    const last = () => term.screen_text().split('\n').filter(Boolean).at(-1)
    const first_row = term.screen_text().split('\n')[0]
    const bottom = last()
    term.scroll(-10)
    expect(term.screen_text().split('\n')[0]).not.toBe(first_row)
    term.scroll_to_bottom()
    expect(last()).toBe(bottom)
    term.clear_scrollback()
    const bar = term.scrollbar()
    expect(bar.total).toBe(bar.len)
  })
})
