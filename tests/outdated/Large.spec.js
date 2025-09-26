import { describe, it, expect, beforeEach } from 'vitest'
import { Large } from '@/persistance/Large'

const MAX_CHUNK_SIZE = 1000

describe('@/persistance/Large', () => {
  let large
  let test_data

  beforeEach(() => {
    large = new Large('test_collection')
    test_data = {
      id: 'test-123',
      content: 'test content'
    }
  })

  describe('Basic Operations', () => {
    it('initializes correctly', () => {
      expect(large.collection).toBe('test_collection')
    })

    it('validates data', () => {
      expect(large.validate(test_data)).toBe(true)
    })
  })

  describe('Chunk Management', () => {
    it('creates chunks from large data', () => {
      const large_content = 'x'.repeat(MAX_CHUNK_SIZE + 100)
      const data = { ...test_data, content: large_content }
      const chunks = large.create_chunks(data)
      expect(chunks.length).toBeGreaterThan(1)
    })

    it('reassembles chunks correctly', () => {
      const chunks = large.create_chunks(test_data)
      const reassembled = large.reassemble_chunks(chunks)
      expect(reassembled).toEqual(test_data)
    })
  })

  describe('Storage Operations', () => {
    it('stores large data', async () => {
      const result = await large.store(test_data)
      expect(result).toBeTruthy()
    })

    it('retrieves stored data', async () => {
      await large.store(test_data)
      const retrieved = await large.get(test_data.id)
      expect(retrieved).toEqual(test_data)
    })
  })

  describe('Error Handling', () => {
    it('handles invalid data', () => {
      const invalid_data = { content: 'missing id' }
      expect(() => large.validate(invalid_data)).toThrow()
    })

    it('handles chunk errors', () => {
      const invalid_chunks = [{ invalid: 'data' }]
      expect(() => large.reassemble_chunks(invalid_chunks)).toThrow()
    })
  })
})
