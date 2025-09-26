import { describe, it, expect, beforeEach } from 'vitest'
import { get_item, set_item, remove_item } from '@/use/item'
import { hydrate } from '@/use/hydrate'

describe('@/use/item', () => {
  let test_item

  beforeEach(() => {
    test_item = {
      id: 'test-123',
      content: 'test content'
    }
  })

  describe('Item Storage', () => {
    it('stores and retrieves items', () => {
      set_item('test-key', test_item)
      const retrieved = get_item('test-key')
      expect(retrieved).toEqual(test_item)
    })

    it('handles missing items', () => {
      const missing = get_item('non-existent')
      expect(missing).toBeNull()
    })

    it('removes items', () => {
      set_item('test-key', test_item)
      remove_item('test-key')
      const removed = get_item('test-key')
      expect(removed).toBeNull()
    })
  })

  describe('Data Validation', () => {
    it('validates item data', () => {
      const valid = { id: 'valid', content: 'test' }
      expect(set_item('valid-key', valid)).toBe(true)
    })

    it('rejects invalid data', () => {
      const invalid = { content: 'missing id' }
      expect(set_item('invalid-key', invalid)).toBe(false)
    })
  })

  describe('Hydration', () => {
    it('hydrates stored items', async () => {
      const hydrated_item = await hydrate.process(test_item)
      expect(hydrated_item).toBeTruthy()
    })

    it('handles hydration errors', async () => {
      const error_item = { id: 'error' }
      await expect(hydrate.process(error_item)).rejects.toThrow()
    })

    it('hydrates with custom options', async () => {
      const options = { deep: true }
      const result = await hydrate.process(test_item, options)
      expect(result).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('handles null values', () => {
      expect(set_item('null-key', null)).toBe(false)
    })

    it('handles undefined values', () => {
      expect(set_item('undefined-key', undefined)).toBe(false)
    })

    it('handles empty objects', () => {
      expect(set_item('empty-key', {})).toBe(false)
    })
  })
})
