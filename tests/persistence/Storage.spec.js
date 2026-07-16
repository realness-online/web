import { describe, it, expect, beforeEach, vi } from 'vite-plus/test'
import {
  Storage,
  Poster,
  Me,
  Relation,
  Thought,
  Event,
  Offline,
  History,
  Statements,
  Cutout,
  Shadow
} from '@/persistence/Storage'

// Mock dependencies
vi.mock('@/utils/itemid', () => ({
  as_type: vi.fn(() => 'posters'),
  as_filename: vi.fn(() => 'test-filename'),
  as_created_at: vi.fn(() => 1234567890),
  as_query_id: vi.fn(() => 'test-query-id'),
  is_itemid: vi.fn(() => true)
}))

const { mock_me, mock_current_user } = vi.hoisted(() => ({
  mock_me: {
    value: /** @type {import('@/types').MeItem | undefined} */ (undefined)
  },
  mock_current_user: {
    value: /** @type {{ uid: string } | null} */ ({ uid: 'test-user' })
  }
}))

vi.mock('@/utils/serverless', () => ({
  me: mock_me,
  current_user: mock_current_user,
  upload: vi.fn(),
  remove: vi.fn(),
  move: vi.fn()
}))

vi.mock('@/utils/profile-sync-log', () => ({
  profile_sync_log: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn()
}))

vi.mock('@/persistence/Directory', () => ({
  as_directory: vi.fn(() => Promise.resolve({ id: 'test-directory' })),
  load_directory_from_network: vi.fn(() => Promise.resolve({ items: [] }))
}))

vi.mock('@/utils/upload-processor', () => ({
  prepare_upload_html: vi.fn(() =>
    Promise.resolve({ compressed: 'test', metadata: {} })
  )
}))

describe('@/persistence/Storage', () => {
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
      mock_me.value = { id: '/+1234567890', name: 'Ada', type: 'person' }
      mock_current_user.value = { uid: 'test-user' }
      const storage = {
        me: '/+1234567890',
        getItem: vi.fn(),
        setItem: vi.fn()
      }
      Object.defineProperty(window, 'localStorage', {
        value: storage,
        writable: true
      })
      me = new Me()
    })

    it('extends Storage with localStorage.me', () => {
      expect(me).toBeInstanceOf(Storage)
      expect(me.id).toBe('/+1234567890')
    })

    it('save returns early when not signed in', async () => {
      mock_current_user.value = null
      mock_me.value = { id: '/+1234567890', name: 'Ada', type: 'person' }
      const save_spy = vi.spyOn(Storage.prototype, 'save')

      await me.save()

      expect(save_spy).not.toHaveBeenCalled()
      mock_current_user.value = { uid: 'test-user' }
      save_spy.mockRestore()
    })

    it('save returns early when me profile is missing', async () => {
      mock_me.value = undefined
      const save_spy = vi.spyOn(Storage.prototype, 'save')

      await me.save()

      expect(save_spy).not.toHaveBeenCalled()
      save_spy.mockRestore()
    })

    it('does not persist an invalid name over a previously saved one', async () => {
      const cached = `<address itemid="/+1234567890"><h3 itemprop="name">Ada Lovelace</h3></address>`
      window.localStorage.getItem = vi.fn(() => cached)
      mock_me.value = { id: '/+1234567890', name: 'ab', type: 'person' }

      const element = document.createElement('address')
      element.setAttribute('itemid', '/+1234567890')
      element.innerHTML = '<h3 itemprop="name">ab</h3>'

      await me.save(element)

      expect(window.localStorage.setItem).toHaveBeenCalled()
      const saved_html = window.localStorage.setItem.mock.calls.at(-1)[1]
      expect(saved_html).toContain('Ada Lovelace')
      expect(saved_html).not.toContain('>ab<')
    })

    it('sets visited when missing before save', async () => {
      mock_me.value = {
        id: '/+1234567890',
        name: 'Ada Lovelace',
        type: 'person'
      }
      const element = document.createElement('address')
      element.setAttribute('itemid', '/+1234567890')
      element.innerHTML = '<h3 itemprop="name">Ada Lovelace</h3>'

      await me.save(element)

      expect(mock_me.value.visited).toBeDefined()
    })
  })

  describe('Statements Class', () => {
    let statements

    beforeEach(() => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          me: '/+1234567890',
          setItem: vi.fn()
        },
        writable: true
      })
      statements = new Statements()
    })

    it('extends Storage with statements path', () => {
      expect(statements).toBeInstanceOf(Storage)
      expect(statements.id).toBe('/+1234567890/statements')
    })

    it('save_statement stores matching element outerHTML', () => {
      const scope = document.createElement('div')
      const statement = document.createElement('div')
      statement.setAttribute('itemid', '/+1234567890/statements/1000')
      statement.textContent = 'hello'
      scope.appendChild(statement)

      const ok = statements.save_statement(
        /** @type {import('@/types').Id} */ ('/+1234567890/statements/1000'),
        scope
      )

      expect(ok).toBe(true)
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        '/+1234567890/statements/1000',
        statement.outerHTML
      )
    })

    it('save_statement returns false when element is missing', () => {
      const scope = document.createElement('div')
      const ok = statements.save_statement(
        /** @type {import('@/types').Id} */ ('/+1234567890/statements/missing'),
        scope
      )
      expect(ok).toBe(false)
    })
  })

  describe('Cutout and Shadow', () => {
    it('Cutout save delegates to Large/Cloud save', async () => {
      const cutout = new Cutout('/+1234567890/cutouts/1000')
      const save_spy = vi
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(cutout)), 'save')
        .mockResolvedValue(undefined)

      await cutout.save()

      expect(save_spy).toHaveBeenCalled()
      save_spy.mockRestore()
    })

    it('Shadow save accepts an explicit element', async () => {
      const shadow = new Shadow('/+1234567890/shadows/1000')
      const save_spy = vi
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(shadow)), 'save')
        .mockResolvedValue(undefined)
      const el = document.createElement('svg')

      await shadow.save(el)

      expect(save_spy).toHaveBeenCalledWith(el)
      save_spy.mockRestore()
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
      Object.defineProperty(window, 'localStorage', {
        value: {
          me: '/+1234567890'
        },
        writable: true
      })
      offline = new Offline('/+/posters/1234567890')
    })

    it('extends Storage', () => {
      expect(offline).toBeInstanceOf(Storage)
      expect(offline.id).toBe('/+/posters/1234567890')
    })

    it('returns early when idb has no outerHTML', async () => {
      const { get } = await import('idb-keyval')
      get.mockResolvedValueOnce(null)
      const save_spy = vi.spyOn(Storage.prototype, 'save')

      await offline.save()

      expect(save_spy).not.toHaveBeenCalled()
      save_spy.mockRestore()
    })

    it('returns early when rewritten itemid is invalid', async () => {
      const { get } = await import('idb-keyval')
      const { is_itemid } = await import('@/utils/itemid')
      get.mockResolvedValueOnce('<div>content</div>')
      is_itemid.mockReturnValueOnce(false)
      const error_log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const save_spy = vi.spyOn(Storage.prototype, 'save')

      await offline.save()

      expect(error_log).toHaveBeenCalledWith(
        'invalid itemid',
        expect.any(String)
      )
      expect(save_spy).not.toHaveBeenCalled()
      error_log.mockRestore()
      save_spy.mockRestore()
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
