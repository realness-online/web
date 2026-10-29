import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

/**
 * m2: on sync, a shared read's URL names its version (`?v=`) and the CDN keeps
 * it forever. A remembered URL whose answer is behind the sync index is looked
 * up again, so a poster rewritten by a sale is never stuck on the old bytes.
 */
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
  url: vi.fn(),
  storage_ready: Promise.resolve(),
  current_user: { value: null },
  directory: vi.fn(),
  me: { value: undefined }
}))

vi.mock('@/utils/storage-mode', () => ({
  synced: {},
  fetch_file: address => globalThis.fetch(address)
}))

const id = /** @type {import('@/types').Id} */ ('/+14155550142')
const filename = 'people/+14155550142/index.html'
const old_url = '/v1/people/%2B14155550142/index.html?v=v1'
const new_url = '/v1/people/%2B14155550142/index.html?v=v2'

/** @param {string} version @param {string} body */
const answer = (version, body) => ({
  ok: true,
  status: 200,
  headers: new Map([
    ['Content-Encoding', 'identity'],
    ['etag', `"${version}"`]
  ]),
  arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer)
})

const know = version =>
  store.set('sync:index', { [id]: { customMetadata: { hash: version } } })

describe('versioned urls on sync', () => {
  beforeEach(async () => {
    store.clear()
    const { use_filename_seam } = await import('@/utils/itemid')
    const { as_filename, as_top_level_filename, set_directory_lookup } =
      await import('@/persistence/store-paths')
    const { as_directory } = await import('@/persistence/store')
    set_directory_lookup(as_directory)
    use_filename_seam({ as_filename, as_top_level_filename })
    store.set('sync:urls', { [id]: { filename, url: old_url } })
    const { url } = await import('@/utils/serverless')
    url.mockReset()
    url.mockResolvedValue(new_url)
  })

  it('uses a remembered url while it answers the known version', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    know('v1')
    globalThis.fetch = vi.fn().mockResolvedValue(answer('v1', 'before'))

    const item = await load_from_network(id)

    expect(item?.html).toBe('before')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(url).not.toHaveBeenCalled()
  })

  it('looks the url up again when the answer is behind the index', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    know('v2')
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(answer('v1', 'before sale'))
      .mockResolvedValueOnce(answer('v2', 'after sale'))

    const item = await load_from_network(id)

    expect(fetch).toHaveBeenNthCalledWith(1, old_url)
    expect(fetch).toHaveBeenNthCalledWith(2, new_url)
    expect(item?.html).toBe('after sale')
    expect(store.get('sync:urls')[id].url).toBe(new_url)
  })

  it('keeps the stale copy while the lookup has not caught up', async () => {
    const { load_from_network } = await import('@/utils/itemid')
    const { url } = await import('@/utils/serverless')
    url.mockResolvedValue(old_url)
    know('v2')
    globalThis.fetch = vi.fn().mockResolvedValue(answer('v1', 'before sale'))

    const item = await load_from_network(id)

    expect(item?.html).toBe('before sale')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
