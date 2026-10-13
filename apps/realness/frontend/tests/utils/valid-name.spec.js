import { describe, it, expect } from 'vite-plus/test'
import { name_error, valid_name } from '@/utils/valid-name'

describe('@/utils/valid-name', () => {
  it('flags empty, whitespace, and non-string names as required', () => {
    expect(name_error('')).toBe('Name is required')
    expect(name_error('   ')).toBe('Name is required')
    expect(name_error(null)).toBe('Name is required')
    expect(name_error(undefined)).toBe('Name is required')
  })

  it('requires at least three characters after trimming', () => {
    expect(name_error('ab')).toBe('At least 3 characters')
    expect(name_error('a')).toBe('At least 3 characters')
  })

  it('accepts names of three or more characters', () => {
    expect(name_error('Ada')).toBeNull()
    expect(valid_name('Ada')).toBe(true)
    expect(valid_name('')).toBe(false)
    expect(valid_name(null)).toBe(false)
  })
})
