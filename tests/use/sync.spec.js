import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { ref } from 'vue'
import {
  sync_offline_actions,
  fresh_metadata,
  i_am_fresh,
  sync_me,
  sync_posters_directory,
  DOES_NOT_EXIST
} from '@/use/sync'

// Mock localStorage BEFORE imports
beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      me: '/+14151234356',
      sync_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
      getItem: vi.fn(key => {
        if (key === '/+14151234356') return '<div>test</div>'
        return null
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    },
    configurable: true,
    writable: true
  })
})

// Mock dependencies
vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
  keys: vi.fn(() => Promise.resolve([]))
}))

vi.mock('@/utils/itemid', () => ({
  as_filename: vi.fn(id => id.replace(/[/+]/g, '')),
  as_author: vi.fn(id => id.split('/')[0]),
  load: vi.fn(() => Promise.resolve([])),
  is_itemid: vi.fn(id => typeof id === 'string' && id.includes('/'))
}))

vi.mock('@/persistance/Directory', () => ({
  build_local_directory: vi.fn(() =>
    Promise.resolve({
      items: ['1000', '2000', '3000']
    })
  )
}))

vi.mock('@/persistance/Storage', () => ({
  Offline: vi.fn().mockImplementation(() => ({
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
  })),
  Relation: vi.fn().mockImplementation(() => ({
    save: vi.fn(() => Promise.resolve())
  })),
  Statement: vi.fn().mockImplementation(() => ({
    sync: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
    optimize: vi.fn(() => Promise.resolve())
  })),
  Event: vi.fn().mockImplementation(() => ({
    sync: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve())
  })),
  Poster: vi.fn().mockImplementation(() => ({
    optimize: vi.fn(() => Promise.resolve())
  })),
  Me: vi.fn().mockImplementation(() => ({
    save: vi.fn(() => Promise.resolve())
  }))
}))

vi.mock('@/use/people', () => ({
  get_my_itemid: vi.fn(type => {
    if (type) return `/+14151234356/${type}`
    return '/+14151234356'
  }),
  use_me: () => ({
    me: ref({
      id: '/+14151234356',
      visited: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    }),
    relations: ref([])
  })
}))

vi.mock('@/use/statement', () => ({
  use: () => ({
    my_statements: ref([])
  })
}))

vi.mock('@/utils/serverless', () => ({
  current_user: ref({ uid: 'test-user' }),
  location: vi.fn(path => `storage/${path}`),
  metadata: vi.fn(() =>
    Promise.resolve({
      updated: new Date().toISOString(),
      customMetadata: { hash: 'abc123' }
    })
  )
}))

vi.mock('@/utils/date', () => ({
  format_time_remaining: vi.fn(time => `${Math.round(time / 1000)}s`)
}))

vi.mock('@/utils/upload-processor', () => ({
  create_hash: vi.fn(() => Promise.resolve('abc123'))
}))

vi.mock('@/utils/algorithms', () => ({
  mutex: {
    lock: vi.fn(() => Promise.resolve()),
    unlock: vi.fn()
  }
}))

vi.mock('@/utils/numbers', () => ({
  JS_TIME: {
    THIRTEEN_MINUTES: 13 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    EIGHT_HOURS: 8 * 60 * 60 * 1000
  }
}))

describe('sync composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DOES_NOT_EXIST constant', () => {
    it('has expected structure', () => {
      expect(DOES_NOT_EXIST).toEqual({
        updated: null,
        customMetadata: { hash: null }
      })
    })
  })

  describe('sync_offline_actions', () => {
    it('returns early when offline', async () => {
      const original_online = navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true
      })

      await sync_offline_actions()

      const { get } = await import('idb-keyval')
      expect(get).not.toHaveBeenCalled()

      Object.defineProperty(navigator, 'onLine', {
        value: original_online,
        configurable: true
      })
    })

    it('processes offline save actions', async () => {
      const { get, del } = await import('idb-keyval')
      const { Offline } = await import('@/persistance/Storage')

      get.mockResolvedValueOnce([
        { action: 'save', id: '/+1234/statements/1000' }
      ])

      await sync_offline_actions()

      expect(Offline).toHaveBeenCalledWith('/+1234/statements/1000')
      expect(del).toHaveBeenCalledWith('sync:offline')
    })

    it('processes offline delete actions', async () => {
      const { get } = await import('idb-keyval')
      const { Offline } = await import('@/persistance/Storage')

      get.mockResolvedValueOnce([
        { action: 'delete', id: '/+1234/statements/1000' }
      ])

      await sync_offline_actions()

      expect(Offline).toHaveBeenCalledWith('/+1234/statements/1000')
    })

    it('handles anonymous posters', async () => {
      const { get, del } = await import('idb-keyval')
      const { build_local_directory } = await import('@/persistance/Directory')
      const { Offline } = await import('@/persistance/Storage')

      get.mockResolvedValue(null)
      build_local_directory.mockResolvedValueOnce({
        items: ['1000', '2000']
      })

      await sync_offline_actions()

      expect(Offline).toHaveBeenCalledWith('/+/posters/1000')
      expect(Offline).toHaveBeenCalledWith('/+/posters/2000')
      expect(del).toHaveBeenCalledWith('/+/posters/')
    })
  })

  describe('fresh_metadata', () => {
    it('retrieves and caches metadata', async () => {
      const { set } = await import('idb-keyval')
      const { metadata } = await import('@/utils/serverless')

      metadata.mockResolvedValueOnce({
        updated: '2024-01-01',
        customMetadata: { hash: 'test123' }
      })

      const result = await fresh_metadata('/+1234/statements/1000')

      expect(result.customMetadata.hash).toBe('test123')
      expect(set).toHaveBeenCalledWith('sync:index', expect.any(Object))
    })

    it('handles object-not-found error', async () => {
      const { metadata } = await import('@/utils/serverless')

      const error = new Error('Not found')
      error.code = 'storage/object-not-found'
      metadata.mockRejectedValueOnce(error)

      const result = await fresh_metadata('/+1234/statements/1000')

      expect(result).toEqual(DOES_NOT_EXIST)
    })

    it('uses mutex for thread safety', async () => {
      const { mutex } = await import('@/utils/algorithms')

      await fresh_metadata('/+1234/statements/1000')

      expect(mutex.lock).toHaveBeenCalled()
      expect(mutex.unlock).toHaveBeenCalled()
    })
  })

  describe('i_am_fresh', () => {
    it('returns true when synced within 8 hours', () => {
      localStorage.sync_time = new Date(
        Date.now() - 1000 * 60 * 60
      ).toISOString() // 1 hour ago

      expect(i_am_fresh()).toBe(true)
    })

    it('returns false when synced over 8 hours ago', () => {
      localStorage.sync_time = new Date(
        Date.now() - 1000 * 60 * 60 * 9
      ).toISOString() // 9 hours ago

      expect(i_am_fresh()).toBe(false)
    })

    it('sets sync_time if not present and returns false', () => {
      const original = localStorage.sync_time
      delete localStorage.sync_time

      const result = i_am_fresh()

      expect(localStorage.sync_time).toBeDefined()
      // When not present, sets to now but synced is set to EIGHT_HOURS
      // which means time_left = 0, so returns false
      expect(result).toBe(false)

      localStorage.sync_time = original
    })
  })

  describe('sync_me', () => {
    it('removes outdated local data', async () => {
      const { get } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')

      get.mockResolvedValueOnce({
        '/+14151234356': {
          customMetadata: { hash: 'network_hash' }
        }
      })
      get.mockResolvedValueOnce('<div>local data</div>')

      create_hash.mockResolvedValueOnce('different_hash')

      await sync_me()

      expect(localStorage.removeItem).toHaveBeenCalledWith('/+14151234356')
    })

    it('returns early when no data', async () => {
      const { get } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')

      get.mockResolvedValue(null)
      localStorage.getItem.mockReturnValueOnce(null)

      await sync_me()

      expect(create_hash).not.toHaveBeenCalled()
    })
  })

  describe('sync_posters_directory', () => {
    it('builds and sorts poster directory', async () => {
      const { set } = await import('idb-keyval')
      const { build_local_directory } = await import('@/persistance/Directory')

      build_local_directory.mockResolvedValueOnce({
        items: ['1000', '3000', '2000']
      })

      await sync_posters_directory()

      expect(set).toHaveBeenCalledWith(
        '/+14151234356/posters/',
        expect.objectContaining({
          items: ['3000', '2000', '1000'], // Sorted descending
          archives: []
        })
      )
    })

    it('returns early when no me', async () => {
      const { get_my_itemid } = await import('@/use/people')
      get_my_itemid.mockReturnValueOnce(null)

      const { set } = await import('idb-keyval')

      await sync_posters_directory()

      expect(set).not.toHaveBeenCalled()
    })

    it('calls Poster optimize', async () => {
      const { Poster } = await import('@/persistance/Storage')

      await sync_posters_directory()

      expect(Poster).toHaveBeenCalledWith('/+14151234356/posters/')
    })
  })
})
