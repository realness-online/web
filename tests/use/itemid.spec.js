import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generate_id, validate_id, parse_id } from '@/use/itemid'

describe('@/use/itemid', () => {
  describe('ID Generation', () => {
    it('generates valid IDs', () => {
      const id = generate_id()
      expect(validate_id(id)).toBe(true)
    })

    it('generates unique IDs', () => {
      const id1 = generate_id()
      const id2 = generate_id()
      expect(id1).not.toBe(id2)
    })
  })

  describe('ID Validation', () => {
    it('validates correct format', () => {
      const valid_id = 'test-123-456'
      expect(validate_id(valid_id)).toBe(true)
    })

    it('rejects invalid format', () => {
      const invalid_ids = ['invalid', 'test_123', '', null, undefined]
      invalid_ids.forEach(id => {
        expect(validate_id(id)).toBe(false)
      })
    })
  })

  describe('ID Parsing', () => {
    it('parses valid IDs', () => {
      const id = 'prefix-123-456'
      const parsed = parse_id(id)
      expect(parsed).toEqual({
        prefix: 'prefix',
        timestamp: '123',
        random: '456'
      })
    })

    it('handles invalid IDs', () => {
      const invalid_id = 'invalid-id'
      expect(() => parse_id(invalid_id)).toThrow()
    })
  })

  describe('Special Cases', () => {
    it('handles timestamp overflow', () => {
      const future_date = new Date('2100-01-01')
      vi.setSystemTime(future_date)
      const id = generate_id()
      expect(validate_id(id)).toBe(true)
      vi.useRealTimers()
    })

    it('handles custom prefixes', () => {
      const prefix = 'custom'
      const id = generate_id(prefix)
      expect(id.startsWith(prefix)).toBe(true)
    })
  })

  describe('Performance', () => {
    it('generates IDs efficiently', () => {
      const start = performance.now()
      for (let i = 0; i < 1000; i++) generate_id()

      const duration = performance.now() - start
      expect(duration).toBeLessThan(1000)
    })
  })
})
