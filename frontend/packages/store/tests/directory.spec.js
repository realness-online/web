import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
vi.mock('idb-keyval', () => import('./fake-idb.js'))
import * as idb from 'idb-keyval'
import { make_backend, make_store } from './fake.js'

const row = (id, items = [], archive = []) => ({
  id,
  types: [],
  archive,
  items
})

describe('directory ids', () => {
  const store = make_store()

  it('accepts an itemid with a trailing slash', () => {
    expect(store.is_directory_id('/+1/posters/1737178477987/')).toBe(true)
    expect(store.is_directory_id('/+1/thoughts/1737178477987/')).toBe(true)
  })

  it('rejects ids without the author, type, or timestamp', () => {
    expect(store.is_directory_id('not-a-directory')).toBe(false)
    expect(store.is_directory_id('/+1/posters/')).toBe(false)
    expect(store.is_directory_id('/1/posters/1737178477987/')).toBe(false)
    expect(store.is_directory_id('/+1/invalid_type/1737178477987/')).toBe(false)
    expect(store.is_directory_id('/+1/posters/abc/')).toBe(false)
  })
})

describe('local listings', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await idb.clear()
  })

  it('groups every cached key under its directory', async () => {
    const { build_local_directory } = make_store()
    await idb.set('/+1/posters/1000', '<article></article>')
    await idb.set('/+1/posters/2000', '<article></article>')
    await idb.set('/+1/thoughts/3000', '<article></article>')

    const directory = await build_local_directory('/+1/posters/')

    expect(directory.items).toEqual([1000, 2000])
  })

  it('clear_author_dirs drops listings and keeps item html', async () => {
    const { clear_author_dirs } = make_store()
    await idb.set('/+1/posters/', row('/+1/posters/', [1000]))
    await idb.set('/+1/posters/1000', '<article></article>')

    await clear_author_dirs('/+1')

    expect(await idb.get('/+1/posters/')).toBeUndefined()
    expect(await idb.get('/+1/posters/1000')).toBe('<article></article>')
  })
})

describe('as_directory', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await idb.clear()
  })

  it('never reaches the backend while a cache exists', async () => {
    const { as_directory, backend } = make_store()
    await idb.set('/+1/posters/', row('/+1/posters/', [1000]))

    const directory = await as_directory('/+1/posters/')

    expect(backend.directory).not.toHaveBeenCalled()
    expect(directory.items).toEqual([1000])
  })

  it('serves a truncated cache verbatim', async () => {
    const { as_directory, backend } = make_store()
    await idb.set('/+1/posters/', row('/+1/posters/', [1000]))
    backend.directory.mockResolvedValue({
      items: [{ name: '1000.html.gz' }, { name: '2000.html.gz' }],
      prefixes: []
    })

    const directory = await as_directory('/+1/posters/')

    expect(directory.items).toEqual([1000])
    expect(backend.directory).not.toHaveBeenCalled()
  })

  it('reads the backend only when nothing is cached', async () => {
    const { as_directory, backend } = make_store()
    backend.directory.mockResolvedValue({
      items: [{ name: '1000.html.gz' }, { name: '2000.html.gz' }],
      prefixes: []
    })

    const directory = await as_directory('/+1/posters/')

    expect(backend.directory).toHaveBeenCalledWith('people/+1/posters/')
    expect(directory.items).toEqual([1000, 2000])
  })

  it('merges locally cached items into a cached listing', async () => {
    const { as_directory } = make_store()
    await idb.set('/+1/posters/', row('/+1/posters/', [1000]))
    await idb.set('/+1/posters/2000', '<article></article>')

    expect((await as_directory('/+1/posters/')).items).toEqual([1000, 2000])
  })
})

describe('load_directory_from_network', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await idb.clear()
  })

  it('keeps base timestamps and drops layer filenames', async () => {
    const { load_directory_from_network, backend } = make_store()
    backend.directory.mockResolvedValue({
      items: [
        { name: '1000.html.gz' },
        { name: '1000-shadows.html.gz' },
        { name: '2000.html.gz' }
      ],
      prefixes: []
    })

    const directory = await load_directory_from_network('/+1/posters')

    expect(backend.directory).toHaveBeenCalledWith('people/+1/posters/')
    expect(directory.items).toEqual([1000, 2000])
    expect(await idb.get('/+1/posters/')).toMatchObject({
      items: [1000, 2000]
    })
  })

  it('records archive folders and their item locations', async () => {
    const { load_directory_from_network, backend } = make_store()
    backend.directory.mockResolvedValue({
      items: [{ name: '1000.html.gz' }],
      prefixes: [{ name: '777' }]
    })

    const directory = await load_directory_from_network('/+1/posters/555/')

    expect(backend.directory).toHaveBeenCalledWith('people/+1/posters/555/')
    expect(directory.archive).toEqual([777])
    expect(await idb.get('/+1/posters/archive-map/')).toEqual({ 1000: 555 })
  })

  it('does not read the backend while offline', async () => {
    const backend = make_backend({ online: () => false })
    const { load_directory_from_network } = make_store({ backend })

    expect(await load_directory_from_network('/+1/posters')).toBeNull()
    expect(backend.directory).not.toHaveBeenCalled()
  })

  it('does not read the backend when the item is not readable', async () => {
    const backend = make_backend({
      signed_in: () => true,
      can_read: () => false
    })
    const { load_directory_from_network } = make_store({ backend })

    expect(await load_directory_from_network('/+1/posters')).toBeNull()
    expect(backend.directory).not.toHaveBeenCalled()
  })
})

describe('as_archive', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await idb.clear()
  })

  it('returns null for an item in the main directory', async () => {
    const { as_archive } = make_store()
    await idb.set('/+1/posters/', row('/+1/posters/', [1000, 2000]))

    expect(await as_archive('/+1/posters/1000')).toBeNull()
  })

  it('resolves from the archive map without scanning', async () => {
    const { as_archive } = make_store()
    await idb.set('/+1/posters/archive-map/', { 1000: 555 })

    expect(await as_archive('/+1/posters/1000')).toBe(
      'people/+1/posters/555/1000'
    )
    expect(idb.get).toHaveBeenCalledTimes(1)
  })

  it('scans archives, heals the map, and reports the items found', async () => {
    const backend = make_backend({ after_directory: vi.fn(async () => {}) })
    const { as_archive } = make_store({ backend })
    await idb.set('/+1/posters/', row('/+1/posters/', [2000], [555]))
    await idb.set('/+1/posters/555/', row('/+1/posters/555/', [1000]))

    expect(await as_archive('/+1/posters/1000')).toBe(
      'people/+1/posters/555/1000'
    )
    expect(await idb.get('/+1/posters/archive-map/')).toEqual({ 1000: 555 })
    expect(backend.after_directory).toHaveBeenCalledWith(['/+1/posters/1000'])
  })
})

describe('remember_archive_locations', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await idb.clear()
  })

  it('writes the map and reports the itemids it proved', async () => {
    const backend = make_backend({ after_directory: vi.fn(async () => {}) })
    const { remember_archive_locations } = make_store({ backend })

    await remember_archive_locations('/+1/posters/555/', 555, [1000])

    expect(await idb.get('/+1/posters/archive-map/')).toEqual({ 1000: 555 })
    expect(backend.after_directory).toHaveBeenCalledWith(['/+1/posters/1000'])
  })
})
