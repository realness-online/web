import { describe, expect, it } from 'vite-plus/test'
import { is_at_end } from '@/utils/chat-scroll'

const box = (scroll_height, scroll_top, client_height) => ({
  scrollHeight: scroll_height,
  scrollTop: scroll_top,
  clientHeight: client_height
})

describe('is_at_end', () => {
  it('is true at the bottom', () => {
    expect(is_at_end(box(1000, 500, 500))).toBe(true)
  })

  it('is true within the slack', () => {
    expect(is_at_end(box(1000, 496, 500))).toBe(true)
  })

  it('is false when scrolled away from the bottom', () => {
    expect(is_at_end(box(1000, 100, 500))).toBe(false)
  })

  it('is true when the content fits', () => {
    expect(is_at_end(box(300, 0, 500))).toBe(true)
  })
})
