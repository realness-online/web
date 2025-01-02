import { describe, it, expect, beforeEach, vi } from 'vitest'
import sorting from '@/utils/sorting'

const TIMESTAMP_1 = 5596668999
const TIMESTAMP_2 = 55966690000

describe('@/use/sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Sorting', () => {
    it('sorts by timestamp', () => {
      const items = [{ timestamp: TIMESTAMP_1 }, { timestamp: TIMESTAMP_2 }]
      const sorted = sorting.by_timestamp(items)
      expect(sorted[0].timestamp).toBe(TIMESTAMP_2)
    })

    it('handles empty arrays', () => {
      const items = []
      const sorted = sorting.by_timestamp(items)
      expect(sorted).toEqual([])
    })
  })

  describe('Custom Sorting', () => {
    const test_items = [
      { name: 'B', order: 2 },
      { name: 'A', order: 1 },
      { name: 'C', order: 3 }
    ]

    it('sorts by custom field', () => {
      const sorted = sorting.by_field(test_items, 'name')
      expect(sorted[0].name).toBe('A')
      expect(sorted[2].name).toBe('C')
    })

    it('sorts by numeric field', () => {
      const sorted = sorting.by_field(test_items, 'order')
      expect(sorted[0].order).toBe(1)
      expect(sorted[2].order).toBe(3)
    })
  })

  describe('Advanced Sorting', () => {
    const complex_items = [
      {
        metadata: { priority: 2 },
        timestamp: TIMESTAMP_1
      },
      {
        metadata: { priority: 1 },
        timestamp: TIMESTAMP_2
      }
    ]

    it('sorts by nested fields', () => {
      const sorted = sorting.by_nested_field(complex_items, 'metadata.priority')
      expect(sorted[0].metadata.priority).toBe(1)
    })

    it('combines multiple sort criteria', () => {
      const sorted = sorting.by_multiple_fields(complex_items, [
        'metadata.priority',
        'timestamp'
      ])
      expect(sorted[0].metadata.priority).toBe(1)
      expect(sorted[0].timestamp).toBe(TIMESTAMP_2)
    })
  })
})
