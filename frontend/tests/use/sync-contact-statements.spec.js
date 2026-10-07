import { describe, it, expect, vi, beforeEach, beforeAll } from 'vite-plus/test'
import { ref } from 'vue'
import { get, set, del } from 'idb-keyval'
import { metadata } from '@/utils/serverless'
import { sync_contact_statements, sync_phonebook_people } from '@/use/sync'

const THEM = '/+14155550101'
const THEIR_STATEMENTS = '/+14155550101/statements'

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      me: '/+14151234356',
      getItem: vi.fn(() => null),
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
  as_created_at: vi.fn(() => null),
  load: vi.fn(() => Promise.resolve(null)),
  load_from_network: vi.fn(() => Promise.resolve(null)),
  type_as_list: vi.fn(() => [])
}))

vi.mock('@/utils/item', () => ({ get_item: vi.fn(() => null) }))
vi.mock('@/utils/person-identity', () => ({
  default_person: { type: 'person', name: '' }
}))
vi.mock('@/utils/profile-sync-log', () => ({ profile_sync_log: vi.fn() }))
vi.mock('@/utils/poster-delete-log', () => ({ poster_delete_log: vi.fn() }))

vi.mock('@/persistence/Directory', () => ({
  build_local_directory: vi.fn(() => Promise.resolve(null)),
  load_directory_from_network: vi.fn(() => Promise.resolve(null)),
  clear_author_dirs: vi.fn(() => Promise.resolve())
}))

vi.mock('@/persistence/Storage', () => ({
  Offline: vi.fn(function () {
    return { save: vi.fn(), delete: vi.fn() }
  }),
  Relation: vi.fn(function () {
    return { save: vi.fn() }
  }),
  Statements: vi.fn(function () {
    return { sync: vi.fn(), save: vi.fn(), optimize: vi.fn() }
  }),
  Event: vi.fn(function () {
    return { sync: vi.fn(), save: vi.fn() }
  }),
  Poster: vi.fn(function () {
    return { optimize: vi.fn() }
  }),
  Me: vi.fn(function () {
    return { save: vi.fn() }
  })
}))

vi.mock('@/use/people', () => ({
  from_e64: e64 => `/${e64}`,
  get_my_itemid: vi.fn(type =>
    type ? `/+14151234356/${type}` : '/+14151234356'
  ),
  use_me: () => ({ me: ref({ id: '/+14151234356' }), relations: ref([]) })
}))

vi.mock('@/use/statements', () => ({ use: () => ({ my_statements: ref([]) }) }))

vi.mock('@/utils/serverless', () => ({
  current_user: ref({ uid: 'them' }),
  me: { value: null },
  location: vi.fn(path => `storage/${path}`),
  directory: vi.fn(() => Promise.resolve({ prefixes: [] })),
  metadata: vi.fn()
}))

// Content addressed, so "same rows edited" and "new row" are distinguishable
// the way they are in production.
vi.mock('@/utils/upload-processor', () => ({
  create_hash: vi.fn(html => Promise.resolve(`hash(${html})`))
}))

vi.mock('@/utils/algorithms', () => ({
  mutex_for: vi.fn(() => ({ lock: vi.fn(), unlock: vi.fn() }))
}))

vi.mock('@/utils/numbers', () => ({
  JS_TIME: { ONE_HOUR: 3600000, EIGHT_HOURS: 8 * 3600000 }
}))

/**
 * A fake IndexedDB that remembers writes. Sync reads `sync:index` back after
 * rewriting it; a store that only answers reads cannot show that.
 * @param {{ cached?: string|null, index?: object }} state
 */
const given = ({ cached = null, index = {} }) => {
  const store = new Map([['sync:index', index]])
  if (cached !== null) store.set(THEIR_STATEMENTS, cached)
  vi.mocked(get).mockImplementation(async key => store.get(key) ?? null)
  vi.mocked(set).mockImplementation(async (key, value) => {
    store.set(key, value)
  })
  vi.mocked(del).mockImplementation(async key => {
    store.delete(key)
  })
  return store
}

const server_says = hash =>
  vi
    .mocked(metadata)
    .mockResolvedValue({ updated: 'now', customMetadata: { hash } })

const server_404 = () =>
  vi.mocked(metadata).mockRejectedValue({ code: 'storage/object-not-found' })

describe('contact statements stay fresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('drops the cache when a contact posts something new', async () => {
    given({ cached: '<div>one</div>' })
    server_says('hash(<div>one</div><div>two</div>)')

    const changed = await sync_contact_statements(THEM)

    expect(del).toHaveBeenCalledWith(THEIR_STATEMENTS)
    expect(changed).toBe(true)
  })

  it('drops the cache when a contact edits a statement in place', async () => {
    // Same row, same id, new words. Row count never changes, so only the hash
    // can tell us. This is the only mutation users have besides posting.
    given({ cached: '<div id="1">before</div>' })
    server_says('hash(<div id="1">after</div>)')

    const changed = await sync_contact_statements(THEM)

    expect(del).toHaveBeenCalledWith(THEIR_STATEMENTS)
    expect(changed).toBe(true)
  })

  it('leaves an unchanged cache alone', async () => {
    given({ cached: '<div>one</div>' })
    server_says('hash(<div>one</div>)')

    const changed = await sync_contact_statements(THEM)

    expect(del).not.toHaveBeenCalled()
    expect(changed).toBe(false)
  })

  it('costs nothing when nothing is cached yet', async () => {
    given({ cached: null })
    server_says('hash(<div>one</div>)')

    const changed = await sync_contact_statements(THEM)

    expect(metadata).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
    expect(changed).toBe(false)
  })

  it('refreshes a stale does-not-exist row instead of trusting it', async () => {
    // The negative cache is the reason a contact who had nothing to say when we
    // first looked could never be seen posting. It must not short circuit us,
    // and it must not be read as "their file is gone" either.
    given({
      cached: '<div>one</div>',
      index: {
        [THEIR_STATEMENTS]: { updated: null, customMetadata: { hash: null } }
      }
    })
    server_says('hash(<div>one</div>)')

    const changed = await sync_contact_statements(THEM)

    expect(metadata).toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
    expect(changed).toBe(false)
  })

  it('drops the cache when their file is really gone from the server', async () => {
    given({ cached: '<div>one</div>' })
    server_404()

    const changed = await sync_contact_statements(THEM)

    expect(del).toHaveBeenCalledWith(THEIR_STATEMENTS)
    expect(changed).toBe(true)
  })

  it('checks statements even when the profile has not changed', async () => {
    // Posting does not rewrite the profile blob, and `visited` restamps at most
    // hourly. Gating this check on a profile hash change loses the post.
    const { directory } = await import('@/utils/serverless')
    vi.mocked(directory).mockResolvedValue({
      prefixes: [{ name: '+14155550101' }]
    })
    vi.mocked(get).mockImplementation(async key => {
      if (key === 'sync:index')
        return {
          [THEM]: { updated: 'now', customMetadata: { hash: 'hash(profile)' } }
        }
      if (key === THEM) return 'profile'
      if (key === THEIR_STATEMENTS) return '<div>one</div>'
      return null
    })
    vi.mocked(metadata).mockImplementation(async path =>
      path.includes('statements')
        ? { updated: 'now', customMetadata: { hash: 'hash(<div>two</div>)' } }
        : { updated: 'now', customMetadata: { hash: 'hash(profile)' } }
    )

    const changed = await sync_phonebook_people({ load_phonebook: undefined })

    expect(del).toHaveBeenCalledWith(THEIR_STATEMENTS)
    expect(changed).toBe(true)
  })
})
