import { describe, it, expect } from 'vitest'
import vectorize from '@/use/vectorize'
import { Poster } from '@/models/posters'

describe('@/use/vectorize', () => {
  const test_data = {
    text: 'Sample text for vectorization',
    numbers: [1, 2, 3],
    metadata: { type: 'test' }
  }

  describe('Basic Vectorization', () => {
    it('creates vector from text', () => {
      const vector = vectorize(test_data.text)
      expect(vector).toBeTruthy()
      expect(Array.isArray(vector)).toBe(true)
    })

    it('handles empty input', () => {
      const vector = vectorize('')
      expect(vector).toEqual([])
    })

    it('produces consistent vectors for same input', () => {
      const vector1 = vectorize(test_data.text)
      const vector2 = vectorize(test_data.text)
      expect(vector1).toEqual(vector2)
    })
  })

  describe('Vector Properties', () => {
    it('creates vectors of correct dimension', () => {
      const vector = vectorize(test_data.text)
      expect(vector.length).toBeGreaterThan(0)
    })

    it('generates normalized vectors', () => {
      const vector = vectorize(test_data.text)
      const magnitude = Math.sqrt(
        vector.reduce((sum, val) => sum + val * val, 0)
      )
      expect(magnitude).toBeCloseTo(1, 5)
    })
  })

  describe('Data Type Handling', () => {
    it('processes numeric data', () => {
      const vector = vectorize(test_data.numbers)
      expect(vector).toBeTruthy()
      expect(Array.isArray(vector)).toBe(true)
    })

    it('handles object data', () => {
      const vector = vectorize(test_data.metadata)
      expect(vector).toBeTruthy()
      expect(Array.isArray(vector)).toBe(true)
    })
  })

  describe('Integration with Posters', () => {
    const poster_data = new Poster({
      title: 'Test Poster',
      content: 'Test content'
    })

    it('vectorizes poster data', () => {
      const vector = vectorize(poster_data)
      expect(vector).toBeTruthy()
      expect(Array.isArray(vector)).toBe(true)
    })

    it('maintains poster data integrity', () => {
      const vector = vectorize(poster_data)
      expect(vector.length).toBeGreaterThan(0)
      expect(poster_data.title).toBe('Test Poster')
    })
  })

  describe('Edge Cases', () => {
    it('handles null input', () => {
      const vector = vectorize(null)
      expect(vector).toEqual([])
    })

    it('handles undefined input', () => {
      const vector = vectorize(undefined)
      expect(vector).toEqual([])
    })
  })
})
