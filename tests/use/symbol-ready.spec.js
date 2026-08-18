import { describe, it, expect } from 'vite-plus/test'
import { report_symbol_ready, is_symbol_ready } from '@/use/symbol-ready'

const layer_id = '/+16282281824/posters/559666932867/rocks'

describe('@/use/symbol-ready', () => {
  it('is not ready until a symbol says so', () => {
    expect(is_symbol_ready(layer_id)).toBe(false)
    report_symbol_ready(layer_id, true)
    expect(is_symbol_ready(layer_id)).toBe(true)
    report_symbol_ready(layer_id, false)
    expect(is_symbol_ready(layer_id)).toBe(false)
  })

  it('stays ready while a second copy of the poster still holds it', () => {
    // A feed and an avatar of the same poster each load their own symbol.
    report_symbol_ready(layer_id, true)
    report_symbol_ready(layer_id, true)

    report_symbol_ready(layer_id, false)
    expect(is_symbol_ready(layer_id)).toBe(true)

    report_symbol_ready(layer_id, false)
    expect(is_symbol_ready(layer_id)).toBe(false)
  })

  it('ignores a report with no id', () => {
    report_symbol_ready('', true)
    expect(is_symbol_ready('')).toBe(false)
  })
})
