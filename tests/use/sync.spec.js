import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterEach
} from 'vite-plus/test'
import { ref, defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { get as get_keyval } from 'idb-keyval'

const mock_me = vi.hoisted(() => ({
  value: {
    id: '/+14151234356',
    type: 'person',
    name: 'Stale_before_sync'
  }
}))
import {
  sync_offline_actions,
  fresh_metadata,
  i_am_fresh,
  sync_me,
  sync_posters_directory,
  DOES_NOT_EXIST,
  use as use_sync
} from '@/use/sync'

function with_setup(composable) {
  let result
  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable()
        return () => {}
      }
    })
  )
  return { result, wrapper }
}

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
  is_itemid: vi.fn(id => typeof id === 'string' && id.includes('/')),
  type_as_list: vi.fn(item => (Array.isArray(item) ? item : [])),
  load_from_network: vi.fn(() =>
    Promise.resolve({
      id: '/+14151234356',
      type: 'person',
      name: 'From_network'
    })
  )
}))

vi.mock('@/utils/item', () => ({
  get_item: vi.fn(() => null)
}))

vi.mock('@/utils/person-identity', () => ({
  default_person: { type: 'person', name: '' }
}))

vi.mock('@/utils/profile-sync-log', () => ({
  profile_sync_log: vi.fn()
}))

vi.mock('@/persistence/Directory', () => ({
  build_local_directory: vi.fn(() =>
    Promise.resolve({
      items: ['1000', '2000', '3000']
    })
  ),
  clear_author_dirs: vi.fn(() => Promise.resolve()),
  as_directory_id: vi.fn(id => `${id}/`)
}))

vi.mock('@/persistence/Storage', () => ({
  Offline: vi.fn(function () {
    return {
      save: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve())
    }
  }),
  Relation: vi.fn(function () {
    return {
      save: vi.fn(() => Promise.resolve())
    }
  }),
  Statements: vi.fn(function () {
    return {
      sync: vi.fn(() => Promise.resolve([])),
      save: vi.fn(() => Promise.resolve()),
      optimize: vi.fn(() => Promise.resolve())
    }
  }),
  Event: vi.fn(function () {
    return {
      sync: vi.fn(() => Promise.resolve([])),
      save: vi.fn(() => Promise.resolve())
    }
  }),
  Poster: vi.fn(function () {
    return {
      optimize: vi.fn(() => Promise.resolve())
    }
  }),
  Me: vi.fn(function () {
    return {
      save: vi.fn(() => Promise.resolve())
    }
  })
}))

vi.mock('@/use/people', () => ({
  from_e64: e64 => `/${e64}`,
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

vi.mock('@/use/statements', () => ({
  use: () => ({
    my_statements: ref([])
  })
}))

vi.mock('@/utils/serverless', () => ({
  current_user: ref({ uid: 'test-user' }),
  me: mock_me,
  location: vi.fn(path => `storage/${path}`),
  directory: vi.fn(() => Promise.resolve({ prefixes: [] })),
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

vi.mock('@/utils/algorithms', () => {
  const mock_mutex = {
    lock: vi.fn(() => Promise.resolve()),
    unlock: vi.fn()
  }
  return {
    mutex_for: vi.fn(() => mock_mutex)
  }
})

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
    vi.mocked(get_keyval).mockResolvedValue(null)
    mock_me.value = {
      id: '/+14151234356',
      type: 'person',
      name: 'Stale_before_sync'
    }
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
      const { Offline } = await import('@/persistence/Storage')

      get.mockResolvedValueOnce([
        { action: 'save', id: '/+1234/thoughts/1000' }
      ])

      await sync_offline_actions()

      expect(Offline).toHaveBeenCalledWith('/+1234/thoughts/1000')
      expect(del).toHaveBeenCalledWith('sync:offline')
    })

    it('processes offline delete actions', async () => {
      const { get } = await import('idb-keyval')
      const { Offline } = await import('@/persistence/Storage')

      get.mockResolvedValueOnce([
        { action: 'delete', id: '/+1234/thoughts/1000' }
      ])

      await sync_offline_actions()

      expect(Offline).toHaveBeenCalledWith('/+1234/thoughts/1000')
    })

    it('saves offline relations via Relation when html is present', async () => {
      const { get } = await import('idb-keyval')
      const { Relation } = await import('@/persistence/Storage')
      const relations_id = '/+14151234356/relations'
      const save = vi.fn(() => Promise.resolve())
      Relation.mockImplementationOnce(function () {
        return { save }
      })

      get.mockResolvedValueOnce([{ action: 'save', id: relations_id }])
      localStorage.getItem.mockReturnValueOnce(
        '<div itemid="relations">r</div>'
      )

      await sync_offline_actions()

      expect(save).toHaveBeenCalledWith({
        outerHTML: '<div itemid="relations">r</div>'
      })
    })

    it('skips anonymous poster block when offline empty and signed in', async () => {
      const { get } = await import('idb-keyval')
      const { build_local_directory } = await import('@/persistence/Directory')

      get.mockResolvedValue(null)

      await sync_offline_actions()

      expect(build_local_directory).not.toHaveBeenCalled()
    })

    it('handles anonymous posters when not signed in', async () => {
      const { get, del } = await import('idb-keyval')
      const { build_local_directory } = await import('@/persistence/Directory')
      const { Offline } = await import('@/persistence/Storage')
      const { current_user } = await import('@/utils/serverless')

      get.mockResolvedValue(null)
      build_local_directory.mockResolvedValueOnce({
        items: ['1000', '2000']
      })
      const was = current_user.value
      current_user.value = null

      await sync_offline_actions()

      expect(Offline).toHaveBeenCalledWith('/+/posters/1000')
      expect(Offline).toHaveBeenCalledWith('/+/posters/2000')
      expect(del).toHaveBeenCalledWith('/+/posters/')

      current_user.value = was
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

      const result = await fresh_metadata('/+1234/thoughts/1000')

      expect(result.customMetadata.hash).toBe('test123')
      expect(set).toHaveBeenCalledWith('sync:index', expect.any(Object))
    })

    it('handles object-not-found error', async () => {
      const { metadata } = await import('@/utils/serverless')

      const error = new Error('Not found')
      error.code = 'storage/object-not-found'
      metadata.mockRejectedValueOnce(error)

      const result = await fresh_metadata('/+1234/thoughts/1000')

      expect(result).toEqual(DOES_NOT_EXIST)
    })

    it('skips metadata when index has idb-cloned missing marker', async () => {
      const { get } = await import('idb-keyval')
      const { metadata } = await import('@/utils/serverless')
      metadata.mockReset()
      const itemid = '/+1234/thoughts/1000'
      get.mockImplementation(key =>
        key === 'sync:index'
          ? Promise.resolve({
              [itemid]: {
                updated: null,
                customMetadata: { hash: null }
              }
            })
          : Promise.resolve(undefined)
      )

      const result = await fresh_metadata(
        /** @type {import('@/types').Id} */ (itemid)
      )

      expect(result).toEqual(DOES_NOT_EXIST)
      expect(metadata).not.toHaveBeenCalled()
    })

    it('uses mutex for thread safety', async () => {
      const { mutex_for } = await import('@/utils/algorithms')
      const index_mutex = mutex_for('sync:index')

      await fresh_metadata('/+1234/thoughts/1000')

      expect(mutex_for).toHaveBeenCalledWith('sync:index')
      expect(index_mutex.lock).toHaveBeenCalled()
      expect(index_mutex.unlock).toHaveBeenCalled()
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
      const { get, set } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')
      const { metadata } = await import('@/utils/serverless')

      metadata.mockResolvedValue({
        updated: new Date().toISOString(),
        customMetadata: { hash: 'network_hash' }
      })

      let index = /** @type {Record<string, unknown>} */ ({})
      get.mockImplementation(key =>
        key === 'sync:index' ? Promise.resolve(index) : Promise.resolve(null)
      )
      set.mockImplementation((key, val) => {
        if (key === 'sync:index')
          index = /** @type {Record<string, unknown>} */ (val)
        return Promise.resolve()
      })

      localStorage.getItem.mockReturnValue('<div>local data</div>')
      create_hash.mockResolvedValue('different_hash')

      await sync_me()

      expect(localStorage.removeItem).toHaveBeenCalledWith('/+14151234356')
      expect(mock_me.value.name).toBe('From_network')
    })

    it('returns early when no data', async () => {
      const { get } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')

      get.mockResolvedValue(null)
      localStorage.getItem.mockReturnValueOnce(null)

      await sync_me()

      expect(create_hash).not.toHaveBeenCalled()
    })

    it('keeps matching local html and applies person fields to me', async () => {
      const { get, set } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')
      const { metadata } = await import('@/utils/serverless')
      const { load } = await import('@/utils/itemid')
      const { current_user } = await import('@/utils/serverless')

      metadata.mockResolvedValue({
        updated: new Date().toISOString(),
        customMetadata: { hash: 'same_hash' }
      })
      create_hash.mockResolvedValue('same_hash')

      let index = /** @type {Record<string, unknown>} */ ({})
      get.mockImplementation(key =>
        key === 'sync:index' ? Promise.resolve(index) : Promise.resolve(null)
      )
      set.mockImplementation((key, val) => {
        if (key === 'sync:index')
          index = /** @type {Record<string, unknown>} */ (val)
        return Promise.resolve()
      })

      localStorage.getItem.mockReturnValue('<address>me</address>')
      load.mockResolvedValueOnce({
        id: '/+14151234356',
        type: 'person',
        name: 'Local_name',
        avatar: '/+14151234356/posters/1'
      })
      mock_me.value = {
        id: '/+14151234356',
        type: 'person',
        name: 'Stale_before_sync',
        visited: new Date().toISOString()
      }
      current_user.value = { uid: 'test-user' }

      await sync_me()

      expect(mock_me.value.name).toBe('Local_name')
      expect(mock_me.value.avatar).toBe('/+14151234356/posters/1')
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('/+14151234356')
    })

    it('falls back to default_person when network profile is missing', async () => {
      const { get, set } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')
      const { metadata } = await import('@/utils/serverless')
      const { load_from_network } = await import('@/utils/itemid')

      metadata.mockResolvedValue({
        updated: new Date().toISOString(),
        customMetadata: { hash: 'network_hash' }
      })
      create_hash.mockResolvedValue('local_hash')

      let index = /** @type {Record<string, unknown>} */ ({})
      get.mockImplementation(key =>
        key === 'sync:index' ? Promise.resolve(index) : Promise.resolve(null)
      )
      set.mockImplementation((key, val) => {
        if (key === 'sync:index')
          index = /** @type {Record<string, unknown>} */ (val)
        return Promise.resolve()
      })

      localStorage.getItem.mockReturnValue('<div>stale</div>')
      load_from_network.mockResolvedValueOnce(null)

      await sync_me()

      expect(mock_me.value).toMatchObject({
        id: '/+14151234356',
        type: 'person',
        name: ''
      })
    })
  })

  describe('sync_posters_directory', () => {
    it('builds and sorts poster directory', async () => {
      const { set } = await import('idb-keyval')
      const { build_local_directory } = await import('@/persistence/Directory')

      build_local_directory.mockResolvedValueOnce({
        items: ['1000', '3000', '2000']
      })

      const changed = await sync_posters_directory()
      expect(changed).toBe(true)

      expect(set).toHaveBeenCalledWith(
        '/+14151234356/posters/',
        expect.objectContaining({
          items: ['3000', '2000', '1000'], // Sorted descending
          archives: []
        })
      )
    })

    it('returns false when poster list unchanged', async () => {
      const { get } = await import('idb-keyval')
      get.mockImplementationOnce(key =>
        key === '/+14151234356/posters/'
          ? Promise.resolve({ items: ['1000', '2000', '3000'] })
          : Promise.resolve(null)
      )

      const { build_local_directory } = await import('@/persistence/Directory')
      build_local_directory.mockResolvedValueOnce({
        items: ['1000', '2000', '3000']
      })

      const changed = await sync_posters_directory()
      expect(changed).toBe(false)
    })

    it('returns early when no me', async () => {
      const { get_my_itemid } = await import('@/use/people')
      get_my_itemid.mockReturnValueOnce(null)

      const { set } = await import('idb-keyval')

      await sync_posters_directory()

      expect(set).not.toHaveBeenCalled()
    })

    it('calls Poster optimize', async () => {
      const { Poster } = await import('@/persistence/Storage')

      await sync_posters_directory()

      expect(Poster).toHaveBeenCalledWith('/+14151234356/posters/')
    })
  })

  describe('use()', () => {
    /** @type {(event: string, ...args: unknown[]) => void} */
    let emit
    /** @type {import('@vue/test-utils').VueWrapper | null} */
    let wrapper

    beforeEach(() => {
      emit = vi.fn()
      wrapper?.unmount()
      wrapper = null
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true
      })
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true
      })
    })

    afterEach(async () => {
      wrapper?.unmount()
      wrapper = null
      const { current_user } = await import('@/utils/serverless')
      current_user.value = { uid: 'test-user' }
    })

    it('skips play work when tab is hidden', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true
      })
      const { current_user } = await import('@/utils/serverless')
      current_user.value = { uid: 'test-user' }

      ;({ wrapper } = with_setup(() => use_sync(emit)))
      await flushPromises()
      emit.mockClear()

      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()

      expect(emit).not.toHaveBeenCalled()
    })

    it('signed-out play syncs public admin feed and emits refreshed', async () => {
      const { current_user, metadata, directory } =
        await import('@/utils/serverless')
      const { clear_author_dirs } = await import('@/persistence/Directory')
      const { get, set, del } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')
      const load_phonebook = vi.fn(() => Promise.resolve())

      current_user.value = null
      vi.stubEnv('VITE_ADMIN_ID', '+14151234356')
      metadata.mockResolvedValue({
        updated: new Date().toISOString(),
        customMetadata: { hash: 'admin_hash' }
      })
      create_hash.mockResolvedValue('stale_local')
      directory.mockResolvedValue({ prefixes: [] })

      let index = /** @type {Record<string, unknown>} */ ({})
      get.mockImplementation(key => {
        if (key === 'sync:index') return Promise.resolve(index)
        if (key === '/+14151234356') return Promise.resolve('<div>admin</div>')
        return Promise.resolve(null)
      })
      set.mockImplementation((key, val) => {
        if (key === 'sync:index')
          index = /** @type {Record<string, unknown>} */ (val)
        return Promise.resolve()
      })
      localStorage.getItem.mockImplementation(key =>
        key === '/+14151234356' ? '<div>admin</div>' : null
      )

      ;({ wrapper } = with_setup(() => use_sync(emit, { load_phonebook })))
      await flushPromises()
      emit.mockClear()
      clear_author_dirs.mockClear()
      del.mockClear()

      window.dispatchEvent(new Event('online'))
      await flushPromises()

      expect(clear_author_dirs).toHaveBeenCalledWith('/+14151234356')
      expect(del).toHaveBeenCalledWith('/+14151234356')
      expect(load_phonebook).toHaveBeenCalled()
      expect(emit).toHaveBeenCalledWith('refreshed')
    })

    it('signed-in stale sync purges missing index rows and runs phonebook', async () => {
      const { current_user, metadata, directory } =
        await import('@/utils/serverless')
      const { get, set, del } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')
      const { DOES_NOT_EXIST: missing } = await import('@/utils/sync-file')
      const load_phonebook = vi.fn(() => Promise.resolve())

      localStorage.sync_time = new Date(
        Date.now() - 1000 * 60 * 60 * 9
      ).toISOString()
      localStorage.me = '/+14151234356'
      current_user.value = { uid: 'test-user' }

      metadata.mockResolvedValue({
        updated: new Date().toISOString(),
        customMetadata: { hash: 'ok' }
      })
      create_hash.mockResolvedValue('ok')
      directory.mockResolvedValue({
        prefixes: [{ name: '+19995551234' }]
      })

      let index = /** @type {Record<string, unknown>} */ ({
        '/+19995550000': missing
      })
      get.mockImplementation(key => {
        if (key === 'sync:index') return Promise.resolve(index)
        if (key === 'sync:offline') return Promise.resolve(null)
        if (String(key).endsWith('/posters/'))
          return Promise.resolve({ items: ['1000'] })
        return Promise.resolve(null)
      })
      set.mockImplementation((key, val) => {
        if (key === 'sync:index')
          index = /** @type {Record<string, unknown>} */ (val)
        return Promise.resolve()
      })
      localStorage.getItem.mockReturnValue(null)

      const mounted = with_setup(() => use_sync(emit, { load_phonebook }))
      wrapper = mounted.wrapper
      const sync = mounted.result
      await flushPromises()

      const statements_el = {
        outerHTML: '<section itemid="/+14151234356/statements"></section>'
      }
      const events_el = {
        outerHTML: '<section itemid="/+14151234356/events"></section>'
      }
      sync.sync_element.value = {
        querySelector: vi.fn(sel => {
          if (sel.includes('statements')) return statements_el
          if (sel.includes('events')) return events_el
          if (sel.includes('relations')) return null
          return null
        })
      }

      emit.mockClear()
      load_phonebook.mockClear()
      window.dispatchEvent(new Event('online'))
      await flushPromises()

      expect(index['/+19995550000']).toBeUndefined()
      expect(load_phonebook).toHaveBeenCalled()
      expect(emit).toHaveBeenCalledWith('active', true)
      expect(emit).toHaveBeenCalledWith('active', false)
      expect(del).toHaveBeenCalled()
    })

    it('sync_relations replaces stale local cache from network', async () => {
      const { current_user, metadata } = await import('@/utils/serverless')
      const { get, set, del } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')
      const { load_from_network, type_as_list } = await import('@/utils/itemid')
      const { Relation } = await import('@/persistence/Storage')
      const save = vi.fn(() => Promise.resolve())
      Relation.mockImplementation(function () {
        return { save }
      })

      localStorage.sync_time = new Date(
        Date.now() - 1000 * 60 * 60 * 9
      ).toISOString()
      current_user.value = { uid: 'test-user' }
      metadata.mockResolvedValue({
        updated: new Date().toISOString(),
        customMetadata: { hash: 'cloud_hash' }
      })
      create_hash.mockResolvedValue('local_hash')
      load_from_network.mockResolvedValue({
        id: '/+14151234356/relations',
        type: 'relations'
      })
      type_as_list.mockReturnValue([{ id: '/+1999' }])

      let index = /** @type {Record<string, unknown>} */ ({})
      get.mockImplementation(key => {
        if (key === 'sync:index') return Promise.resolve(index)
        if (key === '/+14151234356/relations')
          return Promise.resolve('<div>local relations</div>')
        return Promise.resolve(null)
      })
      set.mockImplementation((key, val) => {
        if (key === 'sync:index')
          index = /** @type {Record<string, unknown>} */ (val)
        return Promise.resolve()
      })
      localStorage.getItem.mockImplementation(key =>
        key === '/+14151234356/relations' ? '<div>local relations</div>' : null
      )

      const mounted = with_setup(() => use_sync(emit))
      wrapper = mounted.wrapper
      const sync = mounted.result
      await flushPromises()
      sync.sync_element.value = {
        querySelector: vi.fn(() => ({
          outerHTML: '<div itemid="/+14151234356/relations"></div>'
        }))
      }

      window.dispatchEvent(new Event('online'))
      await flushPromises()

      expect(del).toHaveBeenCalledWith('/+14151234356/relations')
      expect(save).toHaveBeenCalled()
    })
  })
})
