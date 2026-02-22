import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  Storage,
  Poster,
  Me,
  Relation,
  Thought,
  Event,
  Offline,
  History
} from '@/persistance/Storage'

// Mock dependencies
vi.mock('@/utils/itemid', () => ({
  as_type: vi.fn(() => 'posters'),
  as_filename: vi.fn(() => 'test-filename'),
  as_created_at: vi.fn(() => 1234567890),
  as_query_id: vi.fn(() => 'test-query-id'),
  is_itemid: vi.fn(() => true)
}))

vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'test-user' } },
  upload: vi.fn(),
  remove: vi.fn(),
  move: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}))

vi.mock('@/persistance/Directory', () => ({
  as_directory: vi.fn(() => Promise.resolve({ id: 'test-directory' })),
  load_directory_from_network: vi.fn(() => Promise.resolve({ items: [] }))
}))

vi.mock('@/utils/upload-processor', () => ({
  prepare_upload_html: vi.fn(() =>
    Promise.resolve({ compressed: 'test', metadata: {} })
  )
}))

describe('@/persistance/Storage', () => {
  describe('Base Storage Class', () => {
    let storage

    beforeEach(() => {
      storage = new Storage('/+1234567890/posters/1234567890')
    })

    it('initializes with itemid', () => {
      expect(storage.id).toBe('/+1234567890/posters/1234567890')
      expect(storage.type).toBe('posters')
    })

    it('has default metadata', () => {
      expect(storage.metadata).toEqual({ contentType: 'text/html' })
    })

    it('has empty default methods', () => {
      expect(typeof storage.save).toBe('function')
      expect(typeof storage.delete).toBe('function')
      expect(typeof storage.sync).toBe('function')
      expect(typeof storage.optimize).toBe('function')
    })
  })

  describe('Poster Class', () => {
    let poster

    beforeEach(() => {
      poster = new Poster('/+1234567890/posters/1234567890')
    })

    it('extends Storage', () => {
      expect(poster).toBeInstanceOf(Storage)
      expect(poster.id).toBe('/+1234567890/posters/1234567890')
      expect(poster.type).toBe('posters')
    })
  })

  describe('Me Class', () => {
    let me

    beforeEach(() => {
      // Mock localStorage.me
      Object.defineProperty(window, 'localStorage', {
        value: {
          me: '/+1234567890'
        },
        writable: true
      })
      me = new Me()
    })

    it('extends Storage with localStorage.me', () => {
      expect(me).toBeInstanceOf(Storage)
      expect(me.id).toBe('/+1234567890')
    })
  })

  describe('Relation Class', () => {
    let relation

    beforeEach(() => {
      // Mock localStorage.me
      Object.defineProperty(window, 'localStorage', {
        value: {
          me: '/+1234567890'
        },
        writable: true
      })
      relation = new Relation()
    })

    it('extends Storage with relations path', () => {
      expect(relation).toBeInstanceOf(Storage)
      expect(relation.id).toBe('/+1234567890/relations')
    })
  })

  describe('Thought Class', () => {
    let thought

    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: { me: '/+1234567890' },
        writable: true
      })
      thought = new Thought()
    })

    it('extends Storage with thoughts path', () => {
      expect(thought).toBeInstanceOf(Storage)
      expect(thought.id).toBe('/+1234567890/thoughts')
    })
  })

  describe('Event Class', () => {
    let event

    beforeEach(() => {
      // Mock localStorage.me
      Object.defineProperty(window, 'localStorage', {
        value: {
          me: '/+1234567890'
        },
        writable: true
      })
      event = new Event()
    })

    it('extends Storage with events path', () => {
      expect(event).toBeInstanceOf(Storage)
      expect(event.id).toBe('/+1234567890/events')
    })
  })

  describe('Offline Class', () => {
    let offline

    beforeEach(() => {
      offline = new Offline('/+/1234567890/posters/1234567890')
    })

    it('extends Storage', () => {
      expect(offline).toBeInstanceOf(Storage)
      expect(offline.id).toBe('/+/1234567890/posters/1234567890')
    })

    it('has save method that processes outerHTML', async () => {
      // Mock get to return the outerHTML
      const { get } = await import('idb-keyval')
      get.mockResolvedValue('<div>test content</div>')

      // Mock document.createElement
      const mock_element = {
        innerHTML: '',
        firstElementChild: {
          setAttribute: vi.fn(),
          id: ''
        }
      }
      vi.spyOn(document, 'createElement').mockReturnValue(mock_element)

      await offline.save()

      expect(mock_element.firstElementChild.setAttribute).toHaveBeenCalledWith(
        'itemid',
        '/+1234567890/posters/1234567890'
      )
    })
  })

  describe('History Class', () => {
    let history

    beforeEach(() => {
      history = new History('/+1234567890/posters/1234567890')
    })

    it('extends Storage', () => {
      expect(history).toBeInstanceOf(Storage)
      expect(history.id).toBe('/+1234567890/posters/1234567890')
    })

    it('has save method for uploading', async () => {
      const mock_items = { outerHTML: '<div>test</div>' }

      await history.save(mock_items)

      // Should call upload if online and user exists
      const { upload } = await import('@/utils/serverless')
      expect(upload).toHaveBeenCalled()
    })
  })
})
