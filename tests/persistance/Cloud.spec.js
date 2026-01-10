import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Cloud, sync_later } from '@/persistance/Cloud'
import { Storage } from '@/persistance/Storage'

vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'test-user' } },
  upload: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  move: vi.fn(() => Promise.resolve())
}))

vi.mock('@/utils/itemid', () => ({
  as_filename: vi.fn(id => {
    const parts = id.split('/').filter(p => p)
    if (parts.length >= 3) {
      const type = parts[1]
      const timestamp = parts[2]
      const component_types = [
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]
      if (component_types.includes(type)) {
        const layer_name = type
        if (parts.length === 4) {
          return `people/${parts[0]}/posters/${parts[3]}/${timestamp}-${layer_name}.html.gz`
        }
        return `people/${parts[0]}/posters/${timestamp}-${layer_name}.html.gz`
      }
      if (type === 'posters') {
        if (parts.length === 4) {
          return `people/${parts[0]}/posters/${parts[3]}/${timestamp}.html.gz`
        }
        return `people/${parts[0]}/posters/${timestamp}.html.gz`
      }
    }
    return 'test-filename.html.gz'
  }),
  as_type: vi.fn(() => 'posters'),
  as_path_parts: vi.fn(id => {
    const parts = id.split('/').filter(p => p)
    return parts
  })
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve([])),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve())
}))

vi.mock('@/persistance/Directory', () => ({
  as_directory: vi.fn(() => Promise.resolve({ id: 'test-directory' })),
  load_directory_from_network: vi.fn(() => Promise.resolve({ items: [] }))
}))

vi.mock('@/utils/upload-processor', () => ({
  prepare_upload_html: vi.fn(() =>
    Promise.resolve({
      compressed: 'compressed-data',
      metadata: { contentType: 'text/html' }
    })
  )
}))

vi.mock('@/utils/numbers', () => ({
  SIZE: {
    MAX: 10,
    MID: 5
  }
}))

class TestCloudClass extends Cloud(Storage) {
  constructor(itemid) {
    super(itemid)
  }
}

describe('@/persistance/Cloud', () => {
  let cloud_instance
  let mock_navigator

  beforeEach(() => {
    vi.clearAllMocks()

    mock_navigator = { onLine: true }
    Object.defineProperty(window, 'navigator', {
      value: mock_navigator,
      writable: true
    })

    Object.defineProperty(window, 'localStorage', {
      value: { me: '/+1234567890' },
      writable: true
    })

    cloud_instance = new TestCloudClass('/+1234567890/posters/1234567890')
  })

  describe('Cloud Mixin', () => {
    it('adds cloud functionality to base class', () => {
      expect(cloud_instance).toBeInstanceOf(Storage)
      expect(typeof cloud_instance.to_network).toBe('function')
      expect(typeof cloud_instance.save).toBe('function')
      expect(typeof cloud_instance.delete).toBe('function')
      expect(typeof cloud_instance.optimize).toBe('function')
    })

    it('initializes with itemid', () => {
      expect(cloud_instance.id).toBe('/+1234567890/posters/1234567890')
      expect(cloud_instance.type).toBe('posters')
    })
  })

  describe('to_network method', () => {
    it('uploads to network when online and user exists', async () => {
      const mock_items = { outerHTML: '<div>test</div>' }

      await cloud_instance.to_network(mock_items)

      const { upload } = await import('@/utils/serverless')
      expect(upload).toHaveBeenCalledWith(
        'people/+1234567890/posters/1234567890.html.gz',
        'compressed-data',
        { contentType: 'text/html' }
      )
    })

    it('uses get_storage_path when available', async () => {
      cloud_instance.get_storage_path = vi.fn(() =>
        Promise.resolve('people/+1234567890/posters/1234567890.html.gz')
      )
      const mock_items = { outerHTML: '<div>test</div>' }

      await cloud_instance.to_network(mock_items)

      const { upload } = await import('@/utils/serverless')
      expect(cloud_instance.get_storage_path).toHaveBeenCalled()
      expect(upload).toHaveBeenCalledWith(
        'people/+1234567890/posters/1234567890.html.gz',
        'compressed-data',
        { contentType: 'text/html' }
      )
    })

    it('queues for later when offline', async () => {
      mock_navigator.onLine = false
      const mock_items = { outerHTML: '<div>test</div>' }

      await cloud_instance.to_network(mock_items)

      const { set } = await import('idb-keyval')
      expect(set).toHaveBeenCalledWith('sync:offline', [
        { id: '/+1234567890/posters/1234567890', action: 'save' }
      ])
    })
  })

  describe('save method', () => {
    it('saves items and uploads to network', async () => {
      const mock_element = {
        outerHTML: '<div>test content</div>'
      }

      vi.spyOn(document, 'querySelector').mockReturnValue(mock_element)

      await cloud_instance.save()

      const { upload } = await import('@/utils/serverless')
      expect(upload).toHaveBeenCalled()
    })

    it('does nothing when no items provided', async () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null)

      await cloud_instance.save()

      const { upload } = await import('@/utils/serverless')
      expect(upload).not.toHaveBeenCalled()
    })
  })

  describe('delete method', () => {
    it('deletes from network when online', async () => {
      await cloud_instance.delete()

      const { remove } = await import('@/utils/serverless')
      expect(remove).toHaveBeenCalledWith(
        'people/+1234567890/posters/1234567890.html.gz'
      )
    })

    it('uses get_storage_path when available', async () => {
      cloud_instance.get_storage_path = vi.fn(() =>
        Promise.resolve('people/+1234567890/posters/1234567890.html.gz')
      )

      await cloud_instance.delete()

      const { remove } = await import('@/utils/serverless')
      expect(cloud_instance.get_storage_path).toHaveBeenCalled()
      expect(remove).toHaveBeenCalledWith(
        'people/+1234567890/posters/1234567890.html.gz'
      )
    })

    it('queues for later when offline', async () => {
      mock_navigator.onLine = false

      await cloud_instance.delete()

      const { set } = await import('idb-keyval')
      expect(set).toHaveBeenCalledWith('sync:offline', [
        { id: '/+1234567890/posters/1234567890', action: 'delete' }
      ])
    })
  })

  describe('optimize method', () => {
    it('optimizes directory when items exceed max size', async () => {
      const mock_directory = {
        items: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
      }

      const { load_directory_from_network } = await import(
        '@/persistance/Directory'
      )
      load_directory_from_network.mockResolvedValue(mock_directory)

      await cloud_instance.optimize()

      const { move } = await import('@/utils/serverless')
      expect(move).toHaveBeenCalled()

      const component_types = [
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]
      component_types.forEach(component_type => {
        expect(move).toHaveBeenCalledWith(
          component_type,
          expect.any(String),
          expect.any(String),
          expect.any(String)
        )
      })
    })

    it('does nothing when items are within limits', async () => {
      const mock_directory = {
        items: ['1', '2', '3']
      }

      const { load_directory_from_network } = await import(
        '@/persistance/Directory'
      )
      load_directory_from_network.mockResolvedValue(mock_directory)

      await cloud_instance.optimize()

      const { move } = await import('@/utils/serverless')
      expect(move).not.toHaveBeenCalled()
    })
  })

  describe('sync_later function', () => {
    it('adds new sync action to offline queue', async () => {
      await sync_later('/+1234567890/test', 'save')

      const { set } = await import('idb-keyval')
      expect(set).toHaveBeenCalledWith('sync:offline', [
        { id: '/+1234567890/test', action: 'save' }
      ])
    })

    it('does not add duplicate sync actions', async () => {
      const existing_offline = [{ id: '/+1234567890/test', action: 'save' }]
      const { get } = await import('idb-keyval')
      get.mockResolvedValue(existing_offline)

      await sync_later('/+1234567890/test', 'save')

      const { set } = await import('idb-keyval')
      expect(set).not.toHaveBeenCalled()
    })
  })
})
