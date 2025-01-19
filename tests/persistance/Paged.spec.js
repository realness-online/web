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

import { describe, it, expect, beforeEach } from 'vitest'
import { set, get, del } from 'idb-keyval'
import { SIZE } from '@/utils/numbers'
import { History, Statement, Poster } from '@/persistance/Storage'

describe('Paged', () => {
  beforeEach(async () => {
    // Clear storage before each test
    localStorage.clear()
    const keys = (await get('sync:index')) || {}
    for (const key of Object.keys(keys)) await del(key)
  })

  describe('optimize()', () => {
    it('should batch posters into directory entries', async () => {
      const posters = new Poster('test/posters')

      // Create test data with SIZE.MAX + 10 items
      const test_items = Array.from({ length: SIZE.MAX + 10 }, (_, i) => ({
        id: `test/posters/${Date.now() - i * 1000}`,
        type: 'poster',
        content: `test content ${i}`
      }))

      // Save items
      await posters.save(test_items)

      // Run optimize
      await posters.optimize()

      // Check directory structure
      const directory = await get('test/posters/')
      expect(directory.items.length).toBe(SIZE.MID)
      expect(directory.has_more).toBe(true)
      expect(directory.archives.length).toBeGreaterThan(0)

      // Check archive batch
      const first_archive = await get(directory.archives[0].path)
      expect(first_archive.items.length).toBeLessThanOrEqual(SIZE.MAX)
      expect(first_archive.count).toBe(first_archive.items.length)
    })

    it('should batch statements into archive files', async () => {
      const statements = new Statement('test/statements')

      // Create test data
      const test_items = Array.from({ length: SIZE.MAX + 10 }, (_, i) => ({
        id: `test/statements/${Date.now() - i * 1000}`,
        type: 'statement',
        content: `test content ${i}`
      }))

      // Save items
      await statements.save(test_items)

      // Run optimize
      await statements.optimize()

      // Check main file
      const main_content = await get('test/statements')
      const main_doc = new DOMParser().parseFromString(main_content, 'text/html')
      const main_items = main_doc.querySelectorAll('[itemid]')
      expect(main_items.length).toBe(SIZE.MID)

      // Check archive file
      const directory = await get('test/statements/')
      const first_archive = await get(directory.archives[0].path)
      const archive_doc = new DOMParser().parseFromString(first_archive, 'text/html')
      const archive_items = archive_doc.querySelectorAll('[itemid]')
      expect(archive_items.length).toBeLessThanOrEqual(SIZE.MAX)
    })

    it('should not optimize if under SIZE.MAX', async () => {
      const posters = new Poster('test/posters')

      // Create test data with less than SIZE.MAX items
      const test_items = Array.from({ length: SIZE.MAX - 1 }, (_, i) => ({
        id: `test/posters/${Date.now() - i * 1000}`,
        type: 'poster',
        content: `test content ${i}`
      }))

      // Save items
      await posters.save(test_items)

      // Run optimize
      await posters.optimize()

      // Check that no archiving happened
      const directory = await get('test/posters/')
      expect(directory?.archives).toBeUndefined()
    })
  })
})
