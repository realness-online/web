import { describe, it, expect } from 'vite-plus/test'
import { name_error, valid_name } from '@/utils/valid-name'

describe('valid-name', () => {
  describe('name_error', () => {
    it('requires a non-empty trimmed name', () => {
      expect(name_error('')).toBe('Name is required')
      expect(name_error('   ')).toBe('Name is required')
      expect(name_error(undefined)).toBe('Name is required')
    })

    it('requires at least 3 characters', () => {
      expect(name_error('ab')).toBe('At least 3 characters')
      expect(name_error('  ab  ')).toBe('At least 3 characters')
    })

    it('accepts valid names', () => {
      expect(name_error('Ada')).toBeNull()
      expect(name_error('  Yu G  ')).toBeNull()
    })
  })

  describe('valid_name', () => {
    it('matches name_error', () => {
      expect(valid_name('Scott')).toBe(true)
      expect(valid_name('')).toBe(false)
      expect(valid_name('ab')).toBe(false)
    })
  })
})
