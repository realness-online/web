import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { use } from '@/use/directory-processor'

// Mock dependencies
vi.mock('@/use/vectorize', () => ({
  use: () => ({
    new_vector: ref(null),
    new_gradients: ref(null),
    process_photo: vi.fn()
  })
}))

vi.mock('@/use/optimize', () => ({
  use: () => ({
    optimize: vi.fn(poster => Promise.resolve({ ...poster, optimized: true }))
  })
}))

describe('directory-processor composable', () => {
  let processor

  beforeEach(() => {
    processor = use()
  })

  describe('initialization', () => {
    it('returns process_directory function', () => {
      expect(processor.process_directory).toBeTypeOf('function')
    })

    it('returns progress ref with correct initial state', () => {
      expect(processor.progress.value).toEqual({
        total: 0,
        current: 0,
        processing: false,
        current_file: ''
      })
    })

    it('returns completed_poster ref initialized to null', () => {
      expect(processor.completed_poster.value).toBe(null)
    })
  })

  describe('progress tracking', () => {
    it('progress ref is reactive', () => {
      expect(processor.progress.value.processing).toBe(false)
      processor.progress.value.processing = true
      expect(processor.progress.value.processing).toBe(true)
    })

    it('can update current file being processed', () => {
      processor.progress.value.current_file = 'test.jpg'
      expect(processor.progress.value.current_file).toBe('test.jpg')
    })

    it('can track current and total counts', () => {
      processor.progress.value.total = 10
      processor.progress.value.current = 5
      expect(processor.progress.value.total).toBe(10)
      expect(processor.progress.value.current).toBe(5)
    })
  })

  describe('completed_poster', () => {
    it('can store completed poster data', () => {
      const poster_data = { id: 'test', type: 'poster' }
      processor.completed_poster.value = poster_data
      expect(processor.completed_poster.value).toEqual(poster_data)
    })
  })
})
