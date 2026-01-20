import { describe, it, expect, beforeEach, vi } from 'vitest'

// Only mock external I/O - everything else uses real implementations
vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'test-user' } },
  upload: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  move: vi.fn(() => Promise.resolve())
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve())
}))

vi.mock('@/persistance/Directory', () => ({
  as_directory: vi.fn(() =>
    Promise.resolve({
      id: 'test-directory',
      items: [],
      archive: []
    })
  ),
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

// Use real itemid functions - no mocking needed

vi.mock('@/utils/numbers', () => ({
  SIZE: {
    MAX: 10,
    MID: 5
  }
}))

// Mock Storage to prevent circular dependency - Storage uses Cloud at module load time
// Other modules (like sync.js) import Storage, which would trigger the issue
vi.mock('@/persistance/Storage', () => ({
  Storage: class {
    constructor(itemid) {
      this.id = itemid
      this.type = 'posters'
    }
    save() {}
    delete() {}
    sync() {
      return Promise.resolve([])
    }
    optimize() {}
  },
  Poster: class {},
  Cutout: class {},
  Shadow: class {},
  Me: class {},
  Relation: class {},
  Statement: class {},
  Event: class {},
  Offline: class {},
  History: class {}
}))

// Import Cloud and Large - these are what we're testing
import { Cloud, sync_later } from '@/persistance/Cloud'
import { Large } from '@/persistance/Large'
import { upload, remove, move } from '@/utils/serverless'
import { get, set, del } from 'idb-keyval'
import { load_directory_from_network } from '@/persistance/Directory'

// Create a minimal Storage class for testing - don't import the real one
// to avoid circular dependency issues
class Storage {
  constructor(itemid) {
    this.id = itemid
    this.type = 'posters'
  }
  save() {}
  delete() {}
  sync() {
    return Promise.resolve([])
  }
  optimize() {}
}

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

  describe('with Large mixin', () => {
    let large_cloud_instance

    beforeEach(() => {
      const LargeCloud = Large(Cloud(Storage))
      large_cloud_instance = new LargeCloud('/+1234567890/posters/1234567890')
    })

    it('uses get_storage_path from Large mixin', async () => {
      const mock_items = { outerHTML: '<div>test</div>' }

      await large_cloud_instance.to_network(mock_items)

      expect(upload).toHaveBeenCalled()

      const upload_call = upload.mock.calls[0]
      const path = upload_call[0]
      expect(path).toContain('people/+1234567890/posters/1234567890')
    })
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

      expect(upload).toHaveBeenCalled()
    })

    it('does nothing when no items provided', async () => {
      vi.spyOn(document, 'querySelector').mockReturnValue(null)

      await cloud_instance.save()

      expect(upload).not.toHaveBeenCalled()
    })
  })

  describe('delete method', () => {
    it('deletes from network when online', async () => {
      await cloud_instance.delete()

      expect(remove).toHaveBeenCalledWith(
        'people/+1234567890/posters/1234567890.html.gz'
      )
    })

    it('uses get_storage_path when available', async () => {
      cloud_instance.get_storage_path = vi.fn(() =>
        Promise.resolve('people/+1234567890/posters/1234567890.html.gz')
      )

      await cloud_instance.delete()

      expect(cloud_instance.get_storage_path).toHaveBeenCalled()
      expect(remove).toHaveBeenCalledWith(
        'people/+1234567890/posters/1234567890.html.gz'
      )
    })

    it('queues for later when offline', async () => {
      mock_navigator.onLine = false

      await cloud_instance.delete()

      expect(set).toHaveBeenCalledWith('sync:offline', [
        { id: '/+1234567890/posters/1234567890', action: 'delete' }
      ])
    })
  })

  describe('optimize method', () => {
    it('moves poster and all component types together', async () => {
      const mock_directory = {
        items: [
          '100',
          '200',
          '300',
          '400',
          '500',
          '600',
          '700',
          '800',
          '900',
          '1000',
          '1100',
          '1200'
        ]
      }

      load_directory_from_network
        .mockResolvedValueOnce(mock_directory)
        .mockResolvedValueOnce({
          items: ['100', '200', '300', '400', '500', '600', '700']
        })

      await cloud_instance.optimize()
      const component_types = [
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]

      // With 12 items, SIZE.MAX=10, SIZE.MID=5, it should archive 5 posters
      // Each poster has 1 poster file + 6 component files = 7 moves
      // Total: 5 posters × 7 moves = 35 calls
      expect(move).toHaveBeenCalledTimes(35)

      // Verify poster itself is moved (5 times, one for each archived poster)
      expect(move).toHaveBeenCalledWith('posters', '100', '100', '/+1234567890')
      expect(move).toHaveBeenCalledWith('posters', '200', '100', '/+1234567890')
      expect(move).toHaveBeenCalledWith('posters', '300', '100', '/+1234567890')
      expect(move).toHaveBeenCalledWith('posters', '400', '100', '/+1234567890')
      expect(move).toHaveBeenCalledWith('posters', '500', '100', '/+1234567890')

      // Verify all component types are moved for each poster
      component_types.forEach(component_type => {
        // Each component type should be called 5 times (once per archived poster)
        const component_calls = move.mock.calls.filter(
          call => call[0] === component_type
        )
        expect(component_calls).toHaveLength(5)

        // Verify specific calls with correct parameters
        expect(move).toHaveBeenCalledWith(
          component_type,
          '100',
          '100',
          '/+1234567890'
        )
        expect(move).toHaveBeenCalledWith(
          component_type,
          '200',
          '100',
          '/+1234567890'
        )
        expect(move).toHaveBeenCalledWith(
          component_type,
          '300',
          '100',
          '/+1234567890'
        )
        expect(move).toHaveBeenCalledWith(
          component_type,
          '400',
          '100',
          '/+1234567890'
        )
        expect(move).toHaveBeenCalledWith(
          component_type,
          '500',
          '100',
          '/+1234567890'
        )
      })
    })

    it('moves all files together for each timestamp', async () => {
      const mock_directory = {
        items: [
          '1000',
          '2000',
          '3000',
          '4000',
          '5000',
          '6000',
          '7000',
          '8000',
          '9000',
          '10000',
          '11000',
          '12000'
        ]
      }

      load_directory_from_network
        .mockResolvedValueOnce(mock_directory)
        .mockResolvedValueOnce({
          items: ['5000', '6000', '7000', '8000', '9000', '10000', '11000']
        })

      await cloud_instance.optimize()
      const component_types = [
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]

      // For each archived timestamp, verify all 7 files are moved
      const archived_timestamps = ['1000', '2000', '3000', '4000', '5000']
      const archive_directory = '1000' // Oldest timestamp becomes archive directory

      archived_timestamps.forEach(timestamp => {
        // Verify poster is moved
        expect(move).toHaveBeenCalledWith(
          'posters',
          timestamp,
          archive_directory,
          '/+1234567890'
        )

        // Verify all component types are moved
        component_types.forEach(component_type => {
          expect(move).toHaveBeenCalledWith(
            component_type,
            timestamp,
            archive_directory,
            '/+1234567890'
          )
        })
      })
    })

    it('does nothing when items are within limits', async () => {
      const mock_directory = {
        items: ['1', '2', '3']
      }

      load_directory_from_network.mockResolvedValue(mock_directory)

      await cloud_instance.optimize()

      expect(move).not.toHaveBeenCalled()
    })

    it('does not optimize non-archive types', async () => {
      cloud_instance.type = 'statements'
      const mock_directory = {
        items: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
      }

      load_directory_from_network.mockResolvedValue(mock_directory)

      await cloud_instance.optimize()

      expect(move).not.toHaveBeenCalled()
    })
  })

  describe('sync_later function', () => {
    it('adds new sync action to offline queue', async () => {
      await sync_later('/+1234567890/test', 'save')

      expect(set).toHaveBeenCalledWith('sync:offline', [
        { id: '/+1234567890/test', action: 'save' }
      ])
    })

    it('does not add duplicate sync actions', async () => {
      const existing_offline = [{ id: '/+1234567890/test', action: 'save' }]
      get.mockResolvedValue(existing_offline)

      await sync_later('/+1234567890/test', 'save')

      expect(set).not.toHaveBeenCalled()
    })
  })
})
