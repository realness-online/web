import { describe, expect, it } from 'vitest'
import {
  cutout_flags_from_html,
  is_inline_poster_html,
  is_split_poster_html
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

  it('reads embedded cutout symbols from inline html', () => {
    const itemid = '/+1/posters/9'
    const html = `<svg><symbol itemid="/+1/boulders/9"></symbol></svg>`
    expect(cutout_flags_from_html(html, itemid)).toEqual({ boulders: true })
  })
})
