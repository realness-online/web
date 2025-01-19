import { describe, it, expect, vi } from 'vitest'
import { generate_id, validate_id, parse_id } from '@/use/itemid'
import { as_filename, as_archive } from '@/utils/itemid'
import { get } from 'idb-keyval'

vi.mock('idb-keyval')

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

describe('@/utils/itemid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('path generation', () => {
    it('generates correct root path for poster', async () => {
      get.mockResolvedValue({
        items: [1737178477987],
        archive: [1715021054576]
      })

      const result = await as_filename('/+16282281824/posters/1737178477987')
      expect(result).toBe('people/+16282281824/posters/1737178477987.html.gz')
    })

    it('generates correct archive path for archived poster', async () => {
      get.mockResolvedValue({
        items: [],
        archive: [1715021054576]
      })

      const result = await as_filename('/+16282281824/posters/1714021054576')
      expect(result).toBe(
        'people/+16282281824/posters/1715021054576/1714021054576.html.gz'
      )
    })

    it('defaults to root path when no directory exists', async () => {
      get.mockResolvedValue(null)

      const result = await as_filename('/+16282281824/posters/1737178477987')
      expect(result).toBe('people/+16282281824/posters/1737178477987.html.gz')
    })
  })

  describe('archive detection', () => {
    it('returns null for items in main list', async () => {
      get.mockResolvedValue({
        items: [1737178477987],
        archive: []
      })

      const result = await as_archive('/+16282281824/posters/1737178477987')
      expect(result).toBeNull()
    })

    it('returns archive path for archived items', async () => {
      get.mockResolvedValue({
        items: [],
        archive: [1715021054576]
      })

      const result = await as_archive('/+16282281824/posters/1714021054576')
      expect(result).toBe(
        'people/+16282281824/posters/1715021054576/1714021054576'
      )
    })

    it('returns null when directory is missing', async () => {
      get.mockResolvedValue(null)

      const result = await as_archive('/+16282281824/posters/1737178477987')
      expect(result).toBeNull()
    })

    it('returns null when no archives exist', async () => {
      get.mockResolvedValue({
        items: [],
        archive: []
      })

      const result = await as_archive('/+16282281824/posters/1737178477987')
      expect(result).toBeNull()
    })
  })
})
