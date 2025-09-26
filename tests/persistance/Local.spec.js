import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Local } from '@/persistance/Local'
import { Storage } from '@/persistance/Storage'

// Create a test class that uses the Local mixin
class TestLocal extends Local(Storage) {
  constructor(id) {
    super(id)
  }
}

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
    local = new TestLocal('test_collection')
  })

  describe('Storage Operations', () => {
    it('saves data to localStorage', () => {
      // Create a mock DOM element
      const mock_element = {
        outerHTML: '<div>test content</div>'
      }
      
      // Mock document.querySelector to return our mock element
      global.document = {
        querySelector: vi.fn().mockReturnValue(mock_element)
      }
      
      local.save()
      expect(mock_storage.setItem).toHaveBeenCalledWith('test_collection', '<div>test content</div>')
    })

    it('handles missing DOM element', () => {
      // Mock document.querySelector to return null
      global.document = {
        querySelector: vi.fn().mockReturnValue(null)
      }
      
      local.save()
      expect(mock_storage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles storage errors', () => {
      mock_storage.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })
      
      const mock_element = {
        outerHTML: '<div>test content</div>'
      }
      global.document = {
        querySelector: vi.fn().mockReturnValue(mock_element)
      }
      
      expect(() => local.save()).toThrow('Storage full')
    })
  })
})
