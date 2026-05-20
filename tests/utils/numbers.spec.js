import { describe, it, expect } from 'vite-plus/test'
import {
  SIZE,
  JS_TIME,
  itemid_as_kilobytes,
  elements_as_kilobytes
} from '@/utils/numbers'

describe('@/utils/numbers', () => {
  it('exposes storage size thresholds used by Paged.optimize', () => {
    expect(SIZE.MIN).toBeLessThan(SIZE.MID)
    expect(SIZE.MID).toBeLessThan(SIZE.MAX)
  })

  it('itemid_as_kilobytes uses localStorage byte length', () => {
    const id = '/+15551234567/posters/1'
    localStorage.setItem(id, 'x'.repeat(2048))
    expect(itemid_as_kilobytes(id)).toBe(2)
    localStorage.removeItem(id)
  })

  it('itemid_as_kilobytes returns zero when missing', () => {
    expect(itemid_as_kilobytes('/missing')).toBe(0)
  })

  it('elements_as_kilobytes measures outerHTML', () => {
    const el = document.createElement('motion.div')
    el.innerHTML = 'a'.repeat(1024)
    expect(elements_as_kilobytes(el)).toBeGreaterThanOrEqual(1)
  })

  it('elements_as_kilobytes returns zero for null', () => {
    expect(elements_as_kilobytes(null)).toBe(0)
  })

  it('JS_TIME constants are ordered', () => {
    expect(JS_TIME.THREE_MINUTES).toBeLessThan(JS_TIME.FIVE_MINUTES)
    expect(JS_TIME.FIVE_MINUTES).toBeLessThan(JS_TIME.THIRTEEN_MINUTES)
    expect(JS_TIME.THIRTEEN_MINUTES).toBeLessThan(JS_TIME.ONE_HOUR)
    expect(JS_TIME.ONE_HOUR).toBeLessThan(JS_TIME.EIGHT_HOURS)
  })
})
