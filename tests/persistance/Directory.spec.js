import { describe, it, expect } from 'vitest'
import { is_directory_id, as_directory_id } from '@/persistance/Directory'

describe('Directory validation', () => {
  describe('is_directory_id', () => {
    it('validates correct directory ids', () => {
      // Valid itemids with trailing slash should be valid directory ids
      expect(is_directory_id('/+16282281824/posters/1737178477987/')).toBe(true)
      expect(is_directory_id('/+16282281824/statements/1737178477987/')).toBe(
        true
      )
      expect(is_directory_id('/+16282281824/events/1737178477987/')).toBe(true)
      expect(is_directory_id('/+16282281824/relations/1737178477987/')).toBe(
        true
      )
      expect(is_directory_id('/+16282281824/me/1737178477987/')).toBe(true)
    })

    it('rejects invalid directory ids', () => {
      // Invalid format
      expect(is_directory_id('not-a-directory')).toBe(false)
      expect(is_directory_id('')).toBe(false)
      expect(is_directory_id(null)).toBe(false)
      expect(is_directory_id(undefined)).toBe(false)

      // Missing trailing slash
      expect(is_directory_id('/+16282281824/posters/1737178477987')).toBe(false)

      // Missing leading slash
      expect(is_directory_id('+16282281824/posters/1737178477987/')).toBe(false)

      // Invalid author (missing plus)
      expect(is_directory_id('/16282281824/posters/1737178477987/')).toBe(false)

      // Invalid type
      expect(is_directory_id('/+16282281824/invalid_type/1737178477987/')).toBe(
        false
      )

      // Invalid created timestamp (not a number)
      expect(is_directory_id('/+16282281824/posters/abc/')).toBe(false)
      expect(is_directory_id('/+16282281824/posters/123.456/')).toBe(false)

      // Wrong number of segments
      expect(is_directory_id('/+16282281824/posters/')).toBe(false)
      expect(
        is_directory_id('/+16282281824/posters/1737178477987/extra/')
      ).toBe(false)
    })
  })

  describe('as_directory_id', () => {
    it('normalizes root directories to /author/type/ format', () => {
      const expected = '/+14156667777/posters/'

      // Directory path already in correct format
      expect(as_directory_id('/+14156667777/posters/')).toBe(expected)

      // Directory path with index segment (should normalize to root)
      expect(as_directory_id('/+14156667777/posters/index/')).toBe(expected)

      // Individual item id (should normalize to its directory)
      expect(as_directory_id('/+14156667777/posters/1737178477987')).toBe(
        expected
      )
    })

    it('normalizes archive directories correctly', () => {
      // Archive directory path (ends with /)
      expect(as_directory_id('/+14156667777/posters/1737178477987/')).toBe(
        '/+14156667777/posters/1737178477987/'
      )

      // Regular item (not in archive) should normalize to root
      expect(as_directory_id('/+14156667777/posters/1737178477987')).toBe(
        '/+14156667777/posters/'
      )
    })

    it('ensures consistent normalization across different input formats', () => {
      const poster_item = '/+14156667777/posters/1737178477987'
      const poster_directory = '/+14156667777/posters/'
      const poster_index = '/+14156667777/posters/index/'

      // All should normalize to the same root directory
      expect(as_directory_id(poster_item)).toBe(poster_directory)
      expect(as_directory_id(poster_directory)).toBe(poster_directory)
      expect(as_directory_id(poster_index)).toBe(poster_directory)
    })

    it('handles different types consistently', () => {
      expect(as_directory_id('/+14156667777/statements/1234567890')).toBe(
        '/+14156667777/statements/'
      )
      expect(as_directory_id('/+14156667777/events/1234567890')).toBe(
        '/+14156667777/events/'
      )
    })
  })
})
