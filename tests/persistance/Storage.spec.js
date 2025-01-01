import { describe, it, expect, beforeEach } from 'vitest'
import { Storage } from '@/persistance/Storage'

describe('@/persistance/Storage', () => {
  let storage

  beforeEach(() => {
    storage = new Storage('test_collection')
  })

  describe('Basic Operations', () => {
    it('initializes with collection', () => {
      expect(storage.collection).toBe('test_collection')
    })

    it('validates collection name', () => {
      expect(() => new Storage('')).toThrow()
    })
  })

  describe('Data Operations', () => {
    it('implements store method', () => {
      expect(() => storage.store({})).toThrow('Not implemented')
    })

    it('implements get method', () => {
      expect(() => storage.get('test')).toThrow('Not implemented')
    })
  })

  describe('Validation', () => {
    it('validates data structure', () => {
      const valid_data = { id: 'test', content: 'test' }
      expect(storage.validate(valid_data)).toBe(true)
    })

    it('rejects invalid data', () => {
      const invalid_data = { content: 'missing id' }
      expect(storage.validate(invalid_data)).toBe(false)
    })
  })
})
