import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get_item } from '@/utils/item'
import firebase from '@/persistance/firebase'
import CloudSync from '@/persistance/Cloud.sync'

const mock_html = {
  poster: get_item('@@/html/poster.html'),
  statement: get_item('@@/html/statement.html')
}

describe('Cloud.sync', () => {
  let cloud_sync
  let mock_firebase

  beforeEach(() => {
    vi.clearAllMocks()
    mock_firebase = {
      collection: vi.fn().mockReturnThis(),
      doc: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
      set: vi.fn().mockResolvedValue(true)
    }
    vi.spyOn(firebase, 'collection').mockImplementation(() => mock_firebase)
    cloud_sync = new CloudSync()
  })

  describe('Basic Operations', () => {
    it('initializes correctly', () => {
      expect(cloud_sync).toBeTruthy()
      expect(cloud_sync.is_syncing).toBe(false)
    })

    it('handles sync start/stop', async () => {
      await cloud_sync.start_sync()
      expect(cloud_sync.is_syncing).toBe(true)

      cloud_sync.stop_sync()
      expect(cloud_sync.is_syncing).toBe(false)
    })
  })

  describe('Data Syncing', () => {
    it('syncs statements', async () => {
      const statements = [{ id: 'test-1', content: 'test' }]
      mock_firebase.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ statements })
      })

      await cloud_sync.sync_statements()
      expect(firebase.collection).toHaveBeenCalledWith('statements')
    })

    it('syncs posters', async () => {
      const posters = [{ id: 'test-1', name: 'test' }]
      mock_firebase.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ posters })
      })

      await cloud_sync.sync_posters()
      expect(firebase.collection).toHaveBeenCalledWith('posters')
    })
  })

  describe('Error Handling', () => {
    it('handles sync errors', async () => {
      mock_firebase.get.mockRejectedValueOnce(new Error('Sync failed'))
      await expect(cloud_sync.sync_statements()).rejects.toThrow('Sync failed')
    })

    it('handles missing data', async () => {
      mock_firebase.get.mockResolvedValueOnce({ exists: false })
      await cloud_sync.sync_statements()
      expect(cloud_sync.error).toBeTruthy()
    })
  })

  describe('Cache Management', () => {
    it('caches synced data', async () => {
      const test_data = { id: 'test', content: 'cached' }
      mock_firebase.get.mockResolvedValueOnce({
        exists: true,
        data: () => test_data
      })

      await cloud_sync.sync_with_cache('test_collection')
      expect(cloud_sync.cache.has('test_collection')).toBe(true)
    })

    it('uses cached data when available', async () => {
      const cached_data = { id: 'test', content: 'cached' }
      cloud_sync.cache.set('test_collection', cached_data)

      const result = await cloud_sync.get_cached('test_collection')
      expect(result).toEqual(cached_data)
    })
  })

  describe('Real-time Updates', () => {
    it('handles live updates', async () => {
      const update_spy = vi.fn()
      cloud_sync.on_update(update_spy)

      const test_data = { id: 'test', content: 'updated' }
      mock_firebase.onSnapshot?.mockImplementationOnce(callback => {
        callback({ docs: [{ data: () => test_data }] })
        return () => {}
      })

      await cloud_sync.start_live_updates()
      expect(update_spy).toHaveBeenCalledWith(test_data)
    })

    it('stops live updates', async () => {
      const unsubscribe = vi.fn()
      mock_firebase.onSnapshot?.mockReturnValue(unsubscribe)

      await cloud_sync.start_live_updates()
      cloud_sync.stop_live_updates()
      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('Batch Operations', () => {
    it('handles batch updates', async () => {
      const batch_data = [
        { id: 'test-1', content: 'batch 1' },
        { id: 'test-2', content: 'batch 2' }
      ]

      const batch_mock = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(true)
      }
      mock_firebase.batch = vi.fn().mockReturnValue(batch_mock)

      await cloud_sync.batch_update('test_collection', batch_data)
      expect(batch_mock.set).toHaveBeenCalledTimes(2)
      expect(batch_mock.commit).toHaveBeenCalled()
    })

    it('handles batch errors', async () => {
      mock_firebase.batch = vi.fn().mockReturnValue({
        set: vi.fn(),
        commit: vi.fn().mockRejectedValue(new Error('Batch failed'))
      })

      await expect(
        cloud_sync.batch_update('test_collection', [{ id: 'test' }])
      ).rejects.toThrow('Batch failed')
    })
  })

  describe('Sync Progress', () => {
    it('tracks sync progress', async () => {
      const progress_spy = vi.fn()
      cloud_sync.on_progress(progress_spy)

      await cloud_sync.sync_with_progress('test_collection', [
        { id: 'test-1' },
        { id: 'test-2' }
      ])

      expect(progress_spy).toHaveBeenCalledWith(expect.any(Number))
    })

    it('handles sync completion', async () => {
      const complete_spy = vi.fn()
      cloud_sync.on_complete(complete_spy)

      await cloud_sync.sync_all()
      expect(complete_spy).toHaveBeenCalled()
    })
  })

  describe('Data Validation', () => {
    it('validates sync data', () => {
      const valid_data = { id: 'test', content: 'valid' }
      expect(cloud_sync.validate_sync_data(valid_data)).toBe(true)
    })

    it('rejects invalid data', () => {
      const invalid_data = { content: 'missing id' }
      expect(cloud_sync.validate_sync_data(invalid_data)).toBe(false)
    })

    it('handles empty data', () => {
      expect(cloud_sync.validate_sync_data(null)).toBe(false)
      expect(cloud_sync.validate_sync_data(undefined)).toBe(false)
      expect(cloud_sync.validate_sync_data({})).toBe(false)
    })
  })
})
