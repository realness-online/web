import { describe, it, expect, beforeEach, afterEach } from 'vite-plus/test'
import { itemid_as_kilobytes, elements_as_kilobytes } from '@/utils/numbers'

describe('@/utils/numbers', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('converts a stored itemid string length to kilobytes', () => {
    localStorage.setItem('k/1', 'x'.repeat(1024))
    expect(itemid_as_kilobytes('k/1')).toBeCloseTo(1, 2)
  })

  it('returns zero for a missing itemid', () => {
    expect(itemid_as_kilobytes('missing')).toBe(0)
  })

  it('converts an element serialization to kilobytes', () => {
    const el = document.createElement('div')
    el.textContent = 'ab'.repeat(1024)
    document.body.appendChild(el)
    // outerHTML includes the wrapping <div> tags on top of the text
    expect(elements_as_kilobytes(el)).toBeGreaterThan(2)
    document.body.removeChild(el)
  })

  it('returns zero when no element is given', () => {
    expect(elements_as_kilobytes(null)).toBe(0)
  })
})
