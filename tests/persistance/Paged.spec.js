import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Paged } from '@/persistance/Paged'
import firebase from '@/persistance/firebase'

describe('@/persistance/Paged', () => {
  let paged
  let mock_firebase

  beforeEach(() => {
    mock_firebase = {
      collection: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] })
    }
    vi.spyOn(firebase, 'collection').mockImplementation(() => mock_firebase)
    paged = new Paged('test_collection')
  })

  describe('Initialization', () => {
    it('sets up collection', () => {
      expect(paged.collection).toBe('test_collection')
    })

    it('initializes with default page size', () => {
      expect(paged.page_size).toBeGreaterThan(0)
    })
  })

  describe('Page Loading', () => {
    it('loads first page', async () => {
      await paged.load_page()
      expect(mock_firebase.get).toHaveBeenCalled()
    })

    it('loads next page', async () => {
      const mock_docs = [{ id: 'test', data: () => ({ content: 'test' }) }]
      mock_firebase.get.mockResolvedValueOnce({ docs: mock_docs })

      await paged.load_page()
      await paged.load_next_page()
      expect(paged.current_page).toBe(2)
    })
  })

  describe('Data Management', () => {
    it('processes page data', async () => {
      const test_data = { id: 'test', content: 'test' }
      mock_firebase.get.mockResolvedValueOnce({
        docs: [{ data: () => test_data }]
      })

      await paged.load_page()
      expect(paged.items).toContainEqual(test_data)
    })

    it('handles empty pages', async () => {
      await paged.load_page()
      expect(paged.items).toHaveLength(0)
    })
  })

  describe('Error Handling', () => {
    it('handles load errors', async () => {
      mock_firebase.get.mockRejectedValueOnce(new Error('Load failed'))
      await expect(paged.load_page()).rejects.toThrow('Load failed')
    })

    it('handles invalid page numbers', async () => {
      await expect(paged.load_page(-1)).rejects.toThrow()
    })
  })
})

})
