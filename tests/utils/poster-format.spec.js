import { describe, expect, it } from 'vitest'
import {
  cutout_flags_from_html,
  is_inline_poster_html,
  is_split_poster_html,
  layer_html_has_content
} from '@/utils/poster-format'

const inline_html = `<svg itemid="/+1/posters/1"><defs><path itemprop="regular" d="M0 0"/></defs></svg>`
const split_html = `<svg itemid="/+1/posters/2"><use itemprop="shadow" href="#shadow"/></svg>`

describe('poster-format', () => {
  it('detects split posters by shadow use', () => {
    expect(is_split_poster_html(split_html)).toBe(true)
    expect(is_inline_poster_html(split_html)).toBe(false)
  })

  it('detects inline posters without shadow use', () => {
    expect(is_inline_poster_html(inline_html)).toBe(true)
    expect(is_split_poster_html(inline_html)).toBe(false)
  })

  describe('layer_html_has_content', () => {
    // Storage holds layer files that are a symbol wrapping nothing — 150 bytes,
    // zero paths. Counting them as present makes the export wait block on a
    // symbol that never fills.
    const empty_layer = `<symbol id="1-sand-9" itemid="/+1/sand/9" itemscope="" itemtype="/cutouts" viewBox="0 0 512 683"></symbol>`
    const filled_layer = `<symbol id="1-rocks-9" itemid="/+1/rocks/9" viewBox="0 0 512 683"><path d="M0 0"/></symbol>`

    it('rejects a symbol that wraps nothing', () => {
      expect(layer_html_has_content(empty_layer)).toBe(false)
    })

    it('accepts a symbol with paths', () => {
      expect(layer_html_has_content(filled_layer)).toBe(true)
    })

    it('rejects a missing layer', () => {
      expect(layer_html_has_content(null)).toBe(false)
      expect(layer_html_has_content(undefined)).toBe(false)
      expect(layer_html_has_content('')).toBe(false)
    })
  })

  it('reads embedded cutout symbols from inline html', () => {
    const itemid = '/+1/posters/9'
    const html = `<svg><symbol itemid="/+1/boulders/9"></symbol></svg>`
    expect(cutout_flags_from_html(html, itemid)).toEqual({ boulders: true })
  })
})
