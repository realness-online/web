import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock sync.js to prevent it from importing Storage during mock setup
vi.mock('@/use/sync', () => ({}))

// Only mock external I/O - everything else uses real implementations
vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'test-user' } },
  upload: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  move: vi.fn(() => Promise.resolve(true)),
  url: vi.fn(() => Promise.resolve('https://example.com/file'))
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(key =>
    key === 'sync:offline'
      ? Promise.resolve([])
      : Promise.resolve('<svg>test-content</svg>')
  ),
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

vi.mock('@/utils/itemid', async () => {
  const actual = await vi.importActual('@/utils/itemid')
  return {
    ...actual,
    load: vi.fn(() => Promise.resolve('<svg>test-content</svg>')),
    load_from_network: vi.fn(() => Promise.resolve(null))
  }
})

vi.mock('@/utils/numbers', () => ({
  SIZE: {
    MAX: 10,
    MID: 5
  }
}))

// Import Cloud - this is what we're testing
import { Cloud, sync_later } from '@/persistance/Cloud'
import { Large } from '@/persistance/Large'
import { Storage } from '@/persistance/Storage'
import { upload, remove, move } from '@/utils/serverless'
import { get, set, del } from 'idb-keyval'
import { load_directory_from_network } from '@/persistance/Directory'

class TestCloudClass extends Cloud(Storage) {
  constructor(itemid) {
    super(itemid)
  }
}

describe('@/persistance/Cloud', () => {
  let cloud_instance
  let mock_navigator

  beforeEach(() => {
    get.mockClear()
    set.mockClear()
    del.mockClear()
    upload.mockClear()
    remove.mockClear()
    move.mockClear()
    load_directory_from_network.mockClear()
    get.mockImplementation(key =>
      key === 'sync:offline'
        ? Promise.resolve([])
        : Promise.resolve('<svg>test-content</svg>')
    )
    load_directory_from_network.mockImplementation(() =>
      Promise.resolve({ items: [] })
    )

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
    it('deletes poster and all component files from network when online', async () => {
      await cloud_instance.delete()

      const expected_paths = [
        'people/+1234567890/posters/1234567890.html.gz',
        'people/+1234567890/posters/1234567890-shadows.html.gz',
        'people/+1234567890/posters/1234567890-sediment.html.gz',
        'people/+1234567890/posters/1234567890-sand.html.gz',
        'people/+1234567890/posters/1234567890-gravel.html.gz',
        'people/+1234567890/posters/1234567890-rocks.html.gz',
        'people/+1234567890/posters/1234567890-boulders.html.gz'
      ]
      expect(remove).toHaveBeenCalledTimes(7)
      expected_paths.forEach(path => expect(remove).toHaveBeenCalledWith(path))
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
        .mockResolvedValue({
          items: ['100', '200', '300', '400', '500', '600', '700']
        })

      move.mockResolvedValue(true)

      await cloud_instance.optimize()

      // With 12 items, SIZE.MAX=10, SIZE.MID=5, it should archive 5 posters
      // Each poster has 1 poster file + 6 component files = 7 moves
      // Total: 5 posters × 7 moves = 35 calls
      const component_types = [
        'posters',
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]
      const archived_timestamps = ['100', '200', '300', '400', '500']
      const expected_calls = archived_timestamps.length * component_types.length

      expect(move).toHaveBeenCalledTimes(expected_calls)
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
        .mockResolvedValue({
          items: ['5000', '6000', '7000', '8000', '9000', '10000', '11000']
        })

      move.mockResolvedValue(true)

      await cloud_instance.optimize()

      // For each archived timestamp, verify all 7 files are moved
      const archived_timestamps = ['1000', '2000', '3000', '4000', '5000']
      const component_types = [
        'posters',
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]
      const expected_calls = archived_timestamps.length * component_types.length

      expect(move).toHaveBeenCalledTimes(expected_calls)
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
      cloud_instance.type = 'thoughts'
      const mock_directory = {
        items: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
      }

      load_directory_from_network.mockResolvedValue(mock_directory)

      await cloud_instance.optimize()

      expect(move).not.toHaveBeenCalled()
    })

    it('archives all poster components together as a unit', async () => {
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
          items: ['500', '600', '700', '800', '900', '1000', '1100']
        })
        .mockResolvedValue({
          items: ['500', '600', '700', '800', '900', '1000', '1100']
        })

      move.mockResolvedValue(true)

      await cloud_instance.optimize()

      const component_types = [
        'posters',
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]

      const archived_timestamps = ['100', '200', '300', '400', '500']
      const expected_calls = archived_timestamps.length * component_types.length

      expect(move).toHaveBeenCalledTimes(expected_calls)
    })

    it('does not recurse if all moves fail', async () => {
      const console_error_spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

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

      move.mockResolvedValue(false)

      load_directory_from_network
        .mockResolvedValueOnce(mock_directory)
        .mockResolvedValueOnce(mock_directory)

      await cloud_instance.optimize()

      expect(load_directory_from_network).toHaveBeenCalledTimes(2)
      expect(move).toHaveBeenCalled()

      console_error_spy.mockRestore()
    })

    it('recurses only if at least one poster was archived', async () => {
      const console_error_spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

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

      let call_count = 0
      move.mockImplementation(() => {
        call_count++
        if (call_count <= 7) return Promise.resolve(true)
        return Promise.resolve(false)
      })

      load_directory_from_network
        .mockResolvedValueOnce(mock_directory)
        .mockResolvedValueOnce({
          items: [
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
        })
        .mockResolvedValue({
          items: [
            '200',
            '300',
            '400',
            '500',
            '600',
            '700',
            '800',
            '900',
            '1000'
          ]
        })

      await cloud_instance.optimize()

      expect(move).toHaveBeenCalled()
      expect(load_directory_from_network).toHaveBeenCalledTimes(3)

      console_error_spy.mockRestore()
    })

    it('logs which component types fail to move', async () => {
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

      const console_error_spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

      let call_count = 0
      move.mockImplementation((type, timestamp) => {
        call_count++
        if (type === 'posters') return Promise.resolve(true)
        if (type === 'shadows' || type === 'sediment')
          return Promise.resolve(false)
        return Promise.resolve(true)
      })

      load_directory_from_network
        .mockResolvedValueOnce(mock_directory)
        .mockResolvedValueOnce({
          items: ['500', '600', '700', '800', '900', '1000', '1100']
        })
        .mockResolvedValue({
          items: ['500', '600', '700', '800', '900', '1000', '1100']
        })

      await cloud_instance.optimize()

      expect(console_error_spy).toHaveBeenCalled()
      const error_calls = console_error_spy.mock.calls.filter(call =>
        call[0].includes('[optimize] Failed to move components')
      )
      expect(error_calls.length).toBeGreaterThan(0)

      const archived_timestamps = ['100', '200', '300', '400', '500']
      archived_timestamps.forEach(timestamp => {
        const matching_call = error_calls.find(call =>
          call[0].includes(`poster ${timestamp}`)
        )
        expect(matching_call).toBeDefined()
        expect(matching_call[1]).toContain('shadows')
        expect(matching_call[1]).toContain('sediment')
      })

      console_error_spy.mockRestore()
    })

    it('fails entire poster archive if any component move fails', async () => {
      const console_error_spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})

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

      let call_count = 0
      move.mockImplementation((type, timestamp) => {
        call_count++
        if (timestamp === '100' && type === 'shadows')
          return Promise.resolve(false)
        return Promise.resolve(true)
      })

      load_directory_from_network
        .mockResolvedValueOnce(mock_directory)
        .mockResolvedValueOnce({
          items: [
            '200',
            '300',
            '400',
            '500',
            '600',
            '700',
            '800',
            '900',
            '1000',
            '1100'
          ]
        })
        .mockResolvedValue({
          items: [
            '200',
            '300',
            '400',
            '500',
            '600',
            '700',
            '800',
            '900',
            '1000',
            '1100'
          ]
        })

      await cloud_instance.optimize()

      const component_types = [
        'posters',
        'shadows',
        'sediment',
        'sand',
        'gravel',
        'rocks',
        'boulders'
      ]
      const archived_timestamps = ['100', '200', '300', '400', '500']
      const expected_calls = archived_timestamps.length * component_types.length

      expect(move).toHaveBeenCalledTimes(expected_calls)
      expect(load_directory_from_network).toHaveBeenCalledTimes(2)

      console_error_spy.mockRestore()
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
