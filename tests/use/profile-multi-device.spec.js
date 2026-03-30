import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterEach
} from 'vitest'
import { ref } from 'vue'
import { log_as_device } from '../helpers/profile-device-log.js'
import { set_profile_sync_log_sink } from '@/utils/profile-sync-log'

const { mock_me_ref, mock_current_user_ref } = vi.hoisted(() => ({
  mock_me_ref: {
    value: {
      id: '/+14151234356',
      name: 'Device_stale_name',
      type: 'person',
      visited: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    }
  },
  mock_current_user_ref: {
    value: /** @type {{ uid: string } | null} */ ({ uid: 'test-user' })
  }
}))

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      me: '/+14151234356',
      sync_time: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
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
      items: ['1000']
    })
  )
}))

vi.mock('@/persistance/Storage', () => ({
  Offline: vi.fn().mockImplementation(() => ({
    save: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve())
  })),
  Me: vi.fn().mockImplementation(() => ({
    save: vi.fn(() => Promise.resolve())
  })),
  Relation: vi.fn(),
  Statements: vi.fn(),
  Event: vi.fn(),
  Poster: vi.fn()
}))

vi.mock('@/use/people', () => ({
  get_my_itemid: vi.fn(type => {
    if (type) return `/+14151234356/${type}`
    return '/+14151234356'
  }),
  use_me: () => ({
    me: mock_me_ref,
    relations: ref([])
  })
}))

vi.mock('@/utils/serverless', () => ({
  get current_user() {
    return mock_current_user_ref
  },
  me: mock_me_ref,
  location: vi.fn(path => `storage/${path}`),
  metadata: vi.fn(() =>
    Promise.resolve({
      updated: new Date().toISOString(),
      customMetadata: { hash: 'network_hash' }
    })
  )
}))

vi.mock('@/utils/upload-processor', () => ({
  create_hash: vi.fn(() => Promise.resolve('different_from_index'))
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

import { sync_me, visit } from '@/use/sync'
import { Me } from '@/persistance/Storage'

describe('profile multi-device edge cases', () => {
  /** @type {{ event: string, detail: object }[]} */
  let log_entries

  beforeEach(() => {
    vi.clearAllMocks()
    log_entries = []
    set_profile_sync_log_sink((event, detail) => {
      log_entries.push({ event, detail })
    })
    mock_current_user_ref.value = { uid: 'test-user' }
    mock_me_ref.value = {
      id: '/+14151234356',
      name: 'Device_stale_name',
      type: 'person',
      visited: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    }
    localStorage.getItem.mockImplementation(key => {
      if (key === '/+14151234356') return '<div>test</div>'
      return null
    })
  })

  afterEach(() => {
    set_profile_sync_log_sink(null)
  })

  it('sync_me logs and clears local html when indexed hash does not match local hash', async () => {
    const { get } = await import('idb-keyval')
    const { create_hash } = await import('@/utils/upload-processor')

    get.mockResolvedValueOnce({
      '/+14151234356': {
        customMetadata: { hash: 'network_hash' }
      }
    })
    get.mockResolvedValueOnce('<div>local data</div>')
    create_hash.mockResolvedValueOnce('different_from_index')

    await sync_me()

    expect(
      log_entries.some(e => e.event === 'sync_me_cleared_stale_local_html')
    ).toBe(true)
    const cleared = log_entries.find(
      e => e.event === 'sync_me_cleared_stale_local_html'
    )
    expect(cleared?.detail).toMatchObject({
      itemid: '/+14151234356',
      index_hash: 'network_hash',
      local_hash: 'different_from_index'
    })
    expect(localStorage.removeItem).toHaveBeenCalledWith('/+14151234356')
  })

  it('sync_me does not reload me from network (in-memory name can stay stale until another load)', async () => {
    const { get } = await import('idb-keyval')
    const { create_hash } = await import('@/utils/upload-processor')

    mock_me_ref.value.name = 'Only_on_this_tab'

    get.mockResolvedValueOnce({
      '/+14151234356': { customMetadata: { hash: 'remote' } }
    })
    get.mockResolvedValueOnce('<div>x</div>')
    create_hash.mockResolvedValueOnce('local_mismatch')

    await sync_me()

    expect(mock_me_ref.value.name).toBe('Only_on_this_tab')
  })

  it('visit_stamp_save runs when last visited over an hour ago and calls Me.save', async () => {
    const { create_hash } = await import('@/utils/upload-processor')
    create_hash.mockResolvedValue('network_hash')

    const me_el = document.createElement('address')
    me_el.setAttribute('itemid', '/+14151234356')
    document.body.appendChild(me_el)

    mock_me_ref.value.visited = new Date(
      Date.now() - 2 * 60 * 60 * 1000
    ).toISOString()

    await visit({ me: mock_me_ref })

    expect(log_entries.some(e => e.event === 'visit_stamp_save')).toBe(true)
    expect(Me).toHaveBeenCalled()
    const inst = /** @type {{ save: ReturnType<typeof vi.fn> }} */ (
      Me.mock.results[0]?.value
    )
    expect(inst.save).toHaveBeenCalled()

    document.body.removeChild(me_el)
  })

  it('visit does not stamp when visited is within the last hour', async () => {
    mock_me_ref.value.visited = new Date(
      Date.now() - 30 * 60 * 1000
    ).toISOString()

    await visit({ me: mock_me_ref })

    expect(
      log_entries.filter(e => e.event === 'visit_stamp_save')
    ).toHaveLength(0)
    expect(Me).not.toHaveBeenCalled()
  })

  it('simulated two-device log sequence records order of saves for debugging', () => {
    const story = /** @type {{ event: string, detail: object }[]} */ ([])
    set_profile_sync_log_sink((event, detail) => story.push({ event, detail }))

    log_as_device('phone', 'me_save_persist', { name: 'Alice', visited: 't1' })
    log_as_device('laptop', 'me_save_persist', { name: 'Bob', visited: 't2' })

    expect(story[0].detail.simulated_device).toBe('phone')
    expect(story[1].detail.simulated_device).toBe('laptop')
    expect(story[1].detail.name).toBe('Bob')
  })

  describe('bouncing between devices (overwrite risk)', () => {
    const append_address = (/** @type {string} */ name) => {
      const me_el = document.createElement('address')
      me_el.setAttribute('itemid', '/+14151234356')
      me_el.setAttribute('itemscope', '')
      me_el.setAttribute('itemtype', '/person')
      const h3 = document.createElement('h3')
      h3.setAttribute('itemprop', 'name')
      h3.textContent = name
      me_el.appendChild(h3)
      document.body.appendChild(me_el)
      return me_el
    }

    it('after sync_me clears stale local html, visit still uploads tab-local name (not cloud)', async () => {
      const { get } = await import('idb-keyval')
      const { create_hash } = await import('@/utils/upload-processor')

      mock_me_ref.value = {
        id: '/+14151234356',
        name: 'Tab_stale_alice',
        type: 'person',
        visited: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }

      get.mockResolvedValueOnce({
        '/+14151234356': { customMetadata: { hash: 'cloud_hash_bob_won' } }
      })
      get.mockResolvedValueOnce('<div>ignored</div>')
      create_hash.mockResolvedValueOnce('hash_for_alice_html')

      await sync_me()
      expect(localStorage.removeItem).toHaveBeenCalledWith('/+14151234356')

      const el = append_address('Tab_stale_alice')
      Me.mockClear()
      create_hash.mockResolvedValue('network_hash')

      await visit({ me: mock_me_ref })

      expect(Me).toHaveBeenCalled()
      const inst = /** @type {{ save: ReturnType<typeof vi.fn> }} */ (
        Me.mock.results[0]?.value
      )
      const saved = inst.save.mock.calls[0][0]
      // Still reflects tab-local `me` + DOM; cloud may already have another name on another device.
      expect(saved.outerHTML).toContain('Tab_stale_alice')

      document.body.removeChild(el)
    })

    it('when me matches cloud before visit, upload carries that name (stay current)', async () => {
      const { create_hash } = await import('@/utils/upload-processor')

      mock_me_ref.value = {
        id: '/+14151234356',
        name: 'Cloud_truth_bob',
        type: 'person',
        visited: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }

      const el = append_address('Cloud_truth_bob')
      Me.mockClear()
      create_hash.mockResolvedValue('network_hash')

      await visit({ me: mock_me_ref })

      const inst = /** @type {{ save: ReturnType<typeof vi.fn> }} */ (
        Me.mock.results[0]?.value
      )
      const saved = inst.save.mock.calls[0][0]
      expect(saved.outerHTML).toContain('Cloud_truth_bob')

      document.body.removeChild(el)
    })
  })
})
