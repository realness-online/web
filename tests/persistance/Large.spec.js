import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Large } from '@/persistance/Large'
import { Storage } from '@/persistance/Storage'

// Mock dependencies
vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve())
}))

vi.mock('@/persistance/Directory', () => ({
  as_directory: vi.fn(() =>
    Promise.resolve({
      id: '/+1234567890/posters/index/',
      items: [1737178477999, 1737178477888],
      archive: [1234567890]
    })
  ),
  as_directory_id: vi.fn(id => `${id.split('/').slice(0, 3).join('/')}/index/`)
}))

vi.mock('@/utils/itemid', () => ({
  as_created_at: vi.fn(id => {
    const parts = id.split('/')
    return parseInt(parts[parts.length - 1])
  }),
  as_archive: vi.fn(() => Promise.resolve(null)),
  as_author: vi.fn(() => '/+1234567890'),
  as_type: vi.fn(() => 'posters')
}))

// Create a test class that uses the Large mixin
class TestLargeClass extends Large(Storage) {
  constructor(itemid) {
    super(itemid)
  }
}

describe('@/persistance/Large', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get_storage_path', () => {
    it('returns folder path for regular poster', async () => {
      const large = new TestLargeClass('/+1234567890/posters/1737178477999')

      const path = await large.get_storage_path()

      expect(path).toBe(
        'people/+1234567890/posters/1737178477999/index.html.gz'
      )
    })

    it('returns folder path for archived poster', async () => {
      const { as_archive } = await import('@/utils/itemid')
      as_archive.mockResolvedValue(
        'people/+1234567890/posters/1234567890/1234567891'
      )

      const large = new TestLargeClass('/+1234567890/posters/1234567891')

      const path = await large.get_storage_path()

      expect(path).toBe(
        'people/+1234567890/posters/1234567890/1234567891/index.html.gz'
      )
    })

    it('returns folder path for archive folder itself', async () => {
      const { as_archive } = await import('@/utils/itemid')
      as_archive.mockResolvedValue(
        'people/+1234567890/posters/1234567890/1234567890'
      )

      const large = new TestLargeClass('/+1234567890/posters/1234567890')

      const path = await large.get_storage_path()

      expect(path).toBe(
        'people/+1234567890/posters/1234567890/1234567890/index.html.gz'
      )
    })
  })

  describe('save method', () => {
    it('saves to idb-keyval and updates directory', async () => {
      const { get, set } = await import('idb-keyval')
      const { as_created_at } = await import('@/utils/itemid')

      as_created_at.mockReturnValue(1737178477999)
      get.mockResolvedValue({
        items: [1737178477888]
      })

      const large = new TestLargeClass('/+1234567890/posters/1737178477999')
      const mock_element = {
        outerHTML: '<svg>test</svg>'
      }

      vi.spyOn(document, 'querySelector').mockReturnValue(mock_element)

      await large.save()

      expect(set).toHaveBeenCalledWith(
        '/+1234567890/posters/1737178477999',
        '<svg>test</svg>'
      )
      expect(set).toHaveBeenCalledWith(expect.stringContaining('/index/'), {
        items: [1737178477888, 1737178477999]
      })
    })

    it('does nothing when element not found', async () => {
      const large = new TestLargeClass('/+1234567890/posters/1737178477999')

      vi.spyOn(document, 'querySelector').mockReturnValue(null)

      await large.save()

      const { set } = await import('idb-keyval')
      expect(set).not.toHaveBeenCalled()
    })
  })

  describe('delete method', () => {
    it('removes from idb-keyval and updates directory', async () => {
      const { get, set } = await import('idb-keyval')
      const { as_created_at } = await import('@/utils/itemid')

      as_created_at.mockReturnValue(1737178477999)
      get.mockResolvedValue({
        items: [1737178477999, 1737178477888]
      })

      const large = new TestLargeClass('/+1234567890/posters/1737178477999')

      await large.delete()

      const { del } = await import('idb-keyval')
      expect(del).toHaveBeenCalledWith('/+1234567890/posters/1737178477999')
      expect(set).toHaveBeenCalledWith(expect.any(String), {
        items: [1737178477888]
      })
    })
  })
})
