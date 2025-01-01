import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Cloud } from '@/persistance/Cloud'
import firebase from '@/persistance/firebase'

describe('@/persistance/Cloud', () => {
  let cloud
  let mock_firebase

  beforeEach(() => {
    mock_firebase = {
      collection: vi.fn().mockReturnThis(),
      doc: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
      set: vi.fn().mockResolvedValue(true)
    }

    vi.spyOn(firebase, 'collection').mockImplementation(() => mock_firebase)
    cloud = new Cloud('test_collection')
  })

  describe('Basic Operations', () => {
    it('initializes with collection', () => {
      expect(cloud.collection).toBe('test_collection')
    })

    it('connects to firebase', () => {
      expect(firebase.collection).toHaveBeenCalledWith('test_collection')
    })
  })

  describe('Data Operations', () => {
    it('stores data', async () => {
      const test_data = { id: 'test', content: 'test content' }
      await cloud.store(test_data)
      expect(mock_firebase.set).toHaveBeenCalled()
    })

    it('retrieves data', async () => {
      const test_data = { id: 'test', content: 'test content' }
      mock_firebase.get.mockResolvedValueOnce({
        exists: true,
        data: () => test_data
      })
      const result = await cloud.get('test')
      expect(result).toEqual(test_data)
    })
  })

  describe('Error Handling', () => {
    it('handles storage errors', async () => {
      mock_firebase.set.mockRejectedValueOnce(new Error('Storage failed'))
      await expect(cloud.store({})).rejects.toThrow('Storage failed')
    })

    it('handles retrieval errors', async () => {
      mock_firebase.get.mockRejectedValueOnce(new Error('Retrieval failed'))
      await expect(cloud.get('test')).rejects.toThrow('Retrieval failed')
    })
  })
})
