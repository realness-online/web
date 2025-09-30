import { describe, it, expect } from 'vitest'
import { is_directory_id } from '@/persistance/Directory'

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
})
