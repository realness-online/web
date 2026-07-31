import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

const store = new Map()

vi.mock('idb-keyval', () => ({
  get: vi.fn(key => Promise.resolve(store.get(key))),
  set: vi.fn((key, value) => {
    store.set(key, value)
    return Promise.resolve()
  }),
  del: vi.fn(key => {
    store.delete(key)
    return Promise.resolve()
  }),
  keys: vi.fn(() => Promise.resolve([...store.keys()]))
}))

vi.mock('@/utils/upload-processor', () => ({
  decompress_html: vi.fn(),
  compress_html: vi.fn()
}))

vi.mock('@/utils/item', () => ({
  default: vi.fn((html, itemid) => ({ id: itemid, type: 'person', html }))
}))

vi.mock('@/utils/serverless', () => ({
  url: vi.fn(() => Promise.resolve('https://storage/profile.html.gz?token=a')),
  storage_ready: Promise.resolve(),
  current_user: { value: null },
  directory: vi.fn(),
  me: { value: undefined }
}))

const id = /** @type {import('@/types').Id} */ ('/+16282281824')

/** @param {{ok: boolean, body?: string}} options */
const as_response = ({ ok, body = '<address></address>' }) => ({
  ok,
  status: ok ? 200 : 403,
  headers: new Map([['Content-Encoding', 'identity']]),
  arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer)
})

describe('download url cache', () => {
  beforeEach(async () => {
    store.clear()
    const { url } = await import('@/utils/serverless')
    url.mockReset()
    url.mockResolvedValue('https://storage/profile.html.gz?token=a')
  })

  it('asks Storage once and reuses the url after that', async () => {
    const { as_download_url } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')

    const first = await as_download_url(id)
    const second = await as_download_url(id)

    expect(first).toBe('https://storage/profile.html.gz?token=a')
    expect(second).toBe(first)
    expect(url).toHaveBeenCalledTimes(1)
  })

  it('asks again once the item resolves to a different filename', async () => {
    const { as_download_url } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')

    await as_download_url(id)
    store.set('sync:urls', {
      [id]: { filename: 'people/+16282281824/1000.html.gz', url: 'stale' }
    })
    const resolved = await as_download_url(id)

    expect(resolved).toBe('https://storage/profile.html.gz?token=a')
    expect(url).toHaveBeenCalledTimes(2)
  })

  it('forgets a url on request', async () => {
    const { as_download_url, forget_download_url } =
      await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')

    await as_download_url(id)
    await forget_download_url(id)
    await as_download_url(id)

    expect(url).toHaveBeenCalledTimes(2)
    expect(store.get('sync:urls')[id]).toBeDefined()
  })

  it('refetches with a fresh url when a remembered token has rotated', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    store.set('sync:urls', {
      [id]: {
        filename: 'people/+16282281824/index.html.gz',
        url: 'https://old'
      }
    })
    url.mockResolvedValue('https://storage/profile.html.gz?token=b')
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(as_response({ ok: false }))
      .mockResolvedValueOnce(as_response({ ok: true }))

    const item = await load_from_network(id)

    expect(fetch).toHaveBeenNthCalledWith(1, 'https://old')
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://storage/profile.html.gz?token=b'
    )
    expect(item?.id).toBe(id)
    expect(store.get('sync:urls')[id].url).toBe(
      'https://storage/profile.html.gz?token=b'
    )
  })

  it('drops the oldest once it is full, keeping the newest usable', async () => {
    const { as_download_url } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    const filled = {}
    for (let i = 0; i < 500; i++)
      filled[`/+1555000${i}`] = {
        filename: `old-${i}`,
        url: `https://old/${i}`
      }
    store.set('sync:urls', filled)

    await as_download_url(id)

    const cache = store.get('sync:urls')
    expect(Object.keys(cache)).toHaveLength(500)
    expect(cache['/+15550000']).toBeUndefined()
    expect(cache[id].url).toBe('https://storage/profile.html.gz?token=a')

    url.mockClear()
    expect(await as_download_url(id)).toBe(
      'https://storage/profile.html.gz?token=a'
    )
    expect(url).not.toHaveBeenCalled()
  })

  it('keeps a rewritten id once, not twice', async () => {
    const { as_download_url, forget_download_url } =
      await import('@/utils/itemid')

    await as_download_url(id)
    await forget_download_url(id)
    await as_download_url(id)

    expect(Object.keys(store.get('sync:urls'))).toEqual([id])
  })

  it('repairs a remembered url at most once', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    store.set('sync:urls', {
      [id]: {
        filename: 'people/+16282281824/index.html.gz',
        url: 'https://old'
      }
    })
    url.mockResolvedValue('https://storage/profile.html.gz?token=b')
    global.fetch = vi.fn().mockResolvedValue(as_response({ ok: false }))

    const item = await load_from_network(id)

    expect(item).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(url).toHaveBeenCalledTimes(1)
  })
})

// Realness discovers what a person has never posted by asking for it: a feed of
// contacts without statements 404s by design, and those are the requests worth
// counting. The token repair must not turn each one into a second lookup.
describe('items that are not there', () => {
  beforeEach(async () => {
    store.clear()
    const { url } = await import('@/utils/serverless')
    url.mockReset()
    url.mockResolvedValue('https://storage/profile.html.gz?token=a')
  })

  it('costs one lookup and one fetch when the blob 404s', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    global.fetch = vi.fn().mockResolvedValue(as_response({ ok: false }))

    const item = await load_from_network(id)

    expect(item).toBeNull()
    expect(url).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('never fetches when Storage says the object is missing', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    url.mockRejectedValue(
      Object.assign(new Error('not found'), {
        code: 'storage/object-not-found'
      })
    )
    global.fetch = vi.fn()

    const item = await load_from_network(id)

    expect(item).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(store.get('sync:urls')?.[id]).toBeUndefined()
    expect(store.get('sync:index')[id]).toEqual({
      updated: null,
      customMetadata: { hash: null }
    })
  })

  it('stops asking Storage once the missing marker is cached', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    url.mockRejectedValue(
      Object.assign(new Error('not found'), {
        code: 'storage/object-not-found'
      })
    )
    global.fetch = vi.fn()

    await load_from_network(id)
    url.mockClear()
    const second = await load_from_network(id)

    expect(second).toBeNull()
    expect(url).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
