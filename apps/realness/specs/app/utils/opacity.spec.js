import { describe, it, expect } from 'vite-plus/test'
import { change, change_by } from '@/utils/opacity'

const round = n => Math.round(n * 100) / 100

describe('@/utils/opacity', () => {
  it('increments a numeric value by the resolution', () => {
    expect(round(change(0.1))).toBe(round(0.1 + change_by))
    expect(round(change(0.5, 0.01))).toBe(0.51)
  })

  it('parses string inputs before adjusting', () => {
    expect(round(change('0.2'))).toBe(round(0.2 + change_by))
  })

  it('clamps above 1 to the max opacity', () => {
    expect(change(0.95)).toBe(0.9)
  })

  it('clamps below 0 to the default opacity', () => {
    expect(change(-0.5, 0)).toBe(0.025)
    expect(change(0, -1)).toBe(0.025)
  })
})
