import { describe, it, expect } from 'vite-plus/test'
import { is_directory_id, as_directory_id } from '@/persistence/Directory'

describe('Directory validation', () => {
  describe('is_directory_id', () => {
    it('validates correct directory ids', () => {
      expect(is_directory_id('/+14155550142/posters/1737178477987/')).toBe(true)
      expect(is_directory_id('/+14155550142/thoughts/1737178477987/')).toBe(
        true
      )
      expect(is_directory_id('/+14155550142/relations/1737178477987/')).toBe(
        true
      )
      expect(is_directory_id('/+14155550142/me/1737178477987/')).toBe(true)
    })

    it('rejects invalid directory ids', () => {
      expect(is_directory_id('not-a-directory')).toBe(false)
      expect(is_directory_id('')).toBe(false)
      expect(is_directory_id(null)).toBe(false)
      expect(is_directory_id(undefined)).toBe(false)

      expect(is_directory_id('/+14155550142/posters/1737178477987')).toBe(false)

      expect(is_directory_id('+14155550142/posters/1737178477987/')).toBe(false)

      expect(is_directory_id('/14155550142/posters/1737178477987/')).toBe(false)

      expect(is_directory_id('/+14155550142/invalid_type/1737178477987/')).toBe(
        false
      )

      expect(is_directory_id('/+14155550142/posters/abc/')).toBe(false)
      expect(is_directory_id('/+14155550142/posters/123.456/')).toBe(false)

      expect(is_directory_id('/+14155550142/posters/')).toBe(false)
      expect(
        is_directory_id('/+14155550142/posters/1737178477987/extra/')
      ).toBe(false)
    })
  })

  describe('as_directory_id', () => {
    it('normalizes root directories to /author/type/ format', () => {
      const expected = '/+14156667777/posters/'

      expect(as_directory_id('/+14156667777/posters/')).toBe(expected)

      expect(as_directory_id('/+14156667777/posters/index/')).toBe(expected)

      expect(as_directory_id('/+14156667777/posters/1737178477987')).toBe(
        expected
      )
    })

    it('normalizes archive directories correctly', () => {
      expect(as_directory_id('/+14156667777/posters/1737178477987/')).toBe(
        '/+14156667777/posters/1737178477987/'
      )

      expect(as_directory_id('/+14156667777/posters/1737178477987')).toBe(
        '/+14156667777/posters/'
      )
    })

    it('ensures consistent normalization across different input formats', () => {
      const poster_item = '/+14156667777/posters/1737178477987'
      const poster_directory = '/+14156667777/posters/'
      const poster_index = '/+14156667777/posters/index/'

      expect(as_directory_id(poster_item)).toBe(poster_directory)
      expect(as_directory_id(poster_directory)).toBe(poster_directory)
      expect(as_directory_id(poster_index)).toBe(poster_directory)
    })

    it('handles different types consistently', () => {
      expect(as_directory_id('/+14156667777/thoughts/1234567890')).toBe(
        '/+14156667777/thoughts/'
      )
      expect(as_directory_id('/+14156667777/events/1234567890')).toBe(
        '/+14156667777/events/'
      )
    })
  })
})
