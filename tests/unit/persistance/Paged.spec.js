import { describe, it, expect, beforeEach } from 'vitest'
import { set, get, del } from 'idb-keyval'
import { SIZE } from '@/utils/numbers'
import { History, Statements, Posters } from '@/persistance/Storage'

describe('Paged', () => {
  beforeEach(async () => {
    // Clear storage before each test
    localStorage.clear()
    const keys = (await get('sync:index')) || {}
    for (const key of Object.keys(keys)) await del(key)
  })

  describe('optimize()', () => {
    it('should batch posters into directory entries', async () => {
      const posters = new Posters('test/posters')

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
      const statements = new Statements('test/statements')

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
      const main_doc = new DOMParser().parseFromString(
        main_content,
        'text/html'
      )
      const main_items = main_doc.querySelectorAll('[itemid]')
      expect(main_items.length).toBe(SIZE.MID)

      // Check archive file
      const directory = await get('test/statements/')
      const first_archive = await get(directory.archives[0].path)
      const archive_doc = new DOMParser().parseFromString(
        first_archive,
        'text/html'
      )
      const archive_items = archive_doc.querySelectorAll('[itemid]')
      expect(archive_items.length).toBeLessThanOrEqual(SIZE.MAX)
    })

    it('should not optimize if under SIZE.MAX', async () => {
      const posters = new Posters('test/posters')

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
