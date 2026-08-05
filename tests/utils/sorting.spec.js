import { describe, it, expect } from 'vite-plus/test'
import {
  recent_item_first,
  recent_visit_first,
  recent_date_first,
  recent_number_first
} from '@/utils/sorting'

describe('@/utils/sorting', () => {
  it('sorts items by creation, newest first, tolerating missing dates', () => {
    const a = { id: '/+1/posters/1700000000000' }
    const b = { id: '/+1/posters/1800000000000' }
    expect(recent_item_first(a, b)).toBeGreaterThan(0)
    expect(recent_item_first(b, a)).toBeLessThan(0)
    expect(recent_item_first(a, a)).toBe(0)
    // an item with no parseable date sorts as 0
    expect(recent_item_first({ id: '' }, b)).toBeGreaterThan(0)
  })

  it('sorts people by most recent visit, newest first', () => {
    const a = { visited: '2026-01-01T00:00:00Z' }
    const b = { visited: '2026-06-01T00:00:00Z' }
    expect(recent_visit_first(a, b)).toBeGreaterThan(0)
    expect(recent_visit_first(b, a)).toBeLessThan(0)
    expect(recent_visit_first(a, a)).toBe(0)
  })

  it('treats a missing visit as 0', () => {
    const with_visit = { visited: '2026-06-01T00:00:00Z' }
    expect(recent_visit_first({}, with_visit)).toBeGreaterThan(0)
    expect(recent_visit_first(with_visit, {})).toBeLessThan(0)
    expect(recent_visit_first({}, {})).toBe(0)
  })

  it('sorts date strings by clock time, newest first', () => {
    const a = ['2026-01-01T00:00:00Z']
    const b = ['2026-06-01T00:00:00Z']
    expect(recent_date_first(a, b)).toBeGreaterThan(0)
    expect(recent_date_first(b, a)).toBeLessThan(0)
  })

  it('sorts numbers descending, parsing string inputs', () => {
    expect(recent_number_first('10', '2')).toBeLessThan(0)
    expect(recent_number_first(2, 10)).toBeGreaterThan(0)
    expect(recent_number_first(5, 5)).toBe(0)
  })
})
