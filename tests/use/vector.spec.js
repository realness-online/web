import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import vector from '@/use/vector'

describe('@/use/vector', () => {
  const test_vectors = {
    a: [1, 2, 3],
    b: [4, 5, 6],
    empty: []
  }

  describe('Vector Operations', () => {
    it('calculates dot product', () => {
      const result = vector.dot(test_vectors.a, test_vectors.b)
      expect(result).toBe(32) // 1*4 + 2*5 + 3*6
    })

    it('handles empty vectors in dot product', () => {
      const result = vector.dot(test_vectors.empty, test_vectors.a)
      expect(result).toBe(0)
    })
  })

  describe('Vector Normalization', () => {
    it('normalizes vectors', () => {
      const normalized = vector.normalize(test_vectors.a)
      const magnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0))
      expect(magnitude).toBeCloseTo(1, 5)
    })

    it('handles zero vectors', () => {
      const zero_vector = [0, 0, 0]
      const result = vector.normalize(zero_vector)
      expect(result).toEqual(zero_vector)
    })
  })

  describe('Vector Distance', () => {
    it('calculates euclidean distance', () => {
      vi.spyOn(Math, 'sqrt')
      const distance = vector.distance(test_vectors.a, test_vectors.b)
      expect(distance).toBeGreaterThan(0)
      expect(Math.sqrt).toHaveBeenCalled()
    })

    it('returns 0 for identical vectors', () => {
      const distance = vector.distance(test_vectors.a, test_vectors.a)
      expect(distance).toBe(0)
    })
  })

  describe('Vector Validation', () => {
    it('validates vector dimensions', () => {
      const valid = vector.validate_dimensions(test_vectors.a, test_vectors.b)
      expect(valid).toBe(true)
    })

    it('detects mismatched dimensions', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const valid = vector.validate_dimensions(test_vectors.a, [1, 2])
      expect(valid).toBe(false)
      expect(console.error).toHaveBeenCalled()
    })
  })
})
