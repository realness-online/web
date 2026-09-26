import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { DOES_NOT_EXIST } from '@/utils/sync-file'

const { idb_store } = vi.hoisted(() => ({ idb_store: new Map() }))

vi.mock('idb-keyval', () => ({
  get: vi.fn(async key => idb_store.get(key)),
  set: vi.fn(async (key, value) => {
    idb_store.set(key, value)
  })
}))

vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'test-user' } },
  upload: vi.fn(),
  remove: vi.fn(),
  url: vi.fn(),
  directory: vi.fn(),
  location: vi.fn(),
  metadata: vi.fn()
}))

import { metadata, upload } from '@/utils/serverless'
import {
  after_directory,
  after_upload,
  backend,
  is_admin_directory,
  sync_later
} from '@/persistence/store-backend'

describe('upload', () => {
  const refused = Object.assign(new Error('refused'), {
    code: 'storage/unauthorized'
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the stored copy of a sold poster instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(upload).mockRejectedValue(refused)
    const stored = { customMetadata: { sold: 'true' } }
    vi.mocked(metadata).mockResolvedValue(stored)

    await expect(
      backend.upload('people/+1/posters/1000.html.gz', 'html', {})
    ).resolves.toBe(stored)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('still throws a refusal that is not a sale', async () => {
    vi.mocked(upload).mockRejectedValue(refused)
    vi.mocked(metadata).mockResolvedValue({ customMetadata: {} })

    await expect(
      backend.upload('people/+1/posters/1000.html.gz', 'html', {})
    ).rejects.toBe(refused)
  })
})

describe('sync_later', () => {
  beforeEach(() => {
    idb_store.clear()
    vi.clearAllMocks()
  })

  it('adds a new sync action to the offline queue', async () => {
    await sync_later('/+1/posters/1000', 'save')

    expect(idb_store.get('sync:offline')).toEqual([
      { id: '/+1/posters/1000', action: 'save' }
    ])
  })

  it('does not add duplicate actions', async () => {
    await sync_later('/+1/posters/1000', 'save')
    await sync_later('/+1/posters/1000', 'save')

    expect(idb_store.get('sync:offline')).toHaveLength(1)
  })
})

describe('after_upload', () => {
  beforeEach(() => {
    idb_store.clear()
    vi.clearAllMocks()
  })

  it('drops the item from the sync index', async () => {
    idb_store.set('sync:index', {
      '/+1/posters/1000': { updated: 'date' },
      '/+1/posters/2000': { updated: 'date' }
    })

    await after_upload('/+1/posters/1000')

    expect(idb_store.get('sync:index')).toEqual({
      '/+1/posters/2000': { updated: 'date' }
    })
  })

  it('leaves an index without the item alone', async () => {
    idb_store.set('sync:index', { '/+1/posters/2000': { updated: 'date' } })

    await after_upload('/+1/posters/1000')

    expect(idb_store.get('sync:index')).toEqual({
      '/+1/posters/2000': { updated: 'date' }
    })
  })
})

describe('after_directory', () => {
  beforeEach(() => {
    idb_store.clear()
    vi.clearAllMocks()
  })

  it('clears DOES_NOT_EXIST markers for items proven to exist', async () => {
    idb_store.set('sync:index', {
      '/+1/posters/1000': { ...DOES_NOT_EXIST },
      '/+1/posters/2000': { updated: 'date', customMetadata: { hash: 'abc' } }
    })

    await after_directory(['/+1/posters/1000'])

    expect(idb_store.get('sync:index')).toEqual({
      '/+1/posters/2000': { updated: 'date', customMetadata: { hash: 'abc' } }
    })
  })
})

describe('can_read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is true for a signed-in user', () => {
    expect(backend.can_read('/+1/posters/')).toBe(true)
    expect(backend.signed_in()).toBe(true)
  })

  it('is true for the admin id from the environment', () => {
    vi.stubEnv('VITE_ADMIN_ID', '+15550000000')

    expect(is_admin_directory('/+15550000000/posters/')).toBe(true)
    expect(is_admin_directory('/+19999999999/posters/')).toBe(false)
  })
})
