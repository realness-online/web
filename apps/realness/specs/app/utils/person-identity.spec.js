import { describe, it, expect } from 'vite-plus/test'
import { default_person, from_e64 } from '@/utils/person-identity'

describe('@/utils/person-identity', () => {
  it('is a person-shaped shell', () => {
    expect(default_person.type).toBe('person')
    expect('id' in default_person).toBe(true)
  })

  it('names an author from a storage prefix', () => {
    expect(from_e64('+14155550101')).toBe('/+14155550101')
  })
})
