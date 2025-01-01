import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Local } from '@/persistance/Local'

describe('@/persistance/Local', () => {
  let local
  let mock_storage

  beforeEach(() => {
    mock_storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
    global.localStorage = mock_storage
    local = new Local('test_collection')
  })

  describe('Storage Operations', () => {
    it('stores data', () => {
      const test_data = { id: 'test', content: 'test content' }
      local.store(test_data)
      expect(mock_storage.setItem).toHaveBeenCalled()
    })

    it('retrieves data', () => {
      const test_data = { id: 'test', content: 'test content' }
      mock_storage.getItem.mockReturnValue(JSON.stringify(test_data))
      const result = local.get('test')
      expect(result).toEqual(test_data)
    })
  })

  describe('Error Handling', () => {
    it('handles storage errors', () => {
      mock_storage.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })
      expect(() => local.store({})).toThrow('Storage full')
    })

    it('handles retrieval errors', () => {
      mock_storage.getItem.mockReturnValue('invalid json')
      expect(local.get('test')).toBeNull()
    })
  })
})
