import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { content_hash, sync_storage } from '@/utils/sync-storage'

const reply = (status, { headers = {}, body = null } = {}) =>
  new Response(body, { status, headers })

const store = handler => {
  const calls = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push({ url, ...init })
    return handler(url, init)
  })
  return {
    calls,
    storage: sync_storage({ base: '/sync', token: async () => 'tok' })
  }
}

afterEach(() => vi.restoreAllMocks())

describe('sync storage', () => {
  it('pako output is pinned: this HTML always hashes the same', async () => {
    expect(await content_hash('<p itemscope>hello</p>')).toBe(
      'gBeeU7PnHEWVSFR_vLaxqc'
    )
  })

  it('upload sends meta headers and returns the version as the hash', async () => {
    const { calls, storage } = store(() =>
      reply(200, { headers: { etag: '"v1"' } })
    )
    const result = await storage.upload('people/+1/posters/1.html', 'x', {
      customMetadata: { hash: 'ignored', fullLocale: 'en-US' }
    })
    expect(calls[0].url).toBe('/sync/people/%2B1/posters/1.html')
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].headers).toEqual({
      'x-meta-full-locale': 'en-US',
      authorization: 'Bearer tok'
    })
    expect(result.metadata.customMetadata.hash).toBe('v1')
  })

  it('metadata reads the etag as the hash and the meta headers', async () => {
    const { calls, storage } = store(() =>
      reply(200, { headers: { etag: '"v2"', 'x-meta-sold': 'true' } })
    )
    const meta = await storage.metadata(
      storage.location('people/+1/posters/1.html')
    )
    expect(calls[0].method).toBe('HEAD')
    expect(meta.customMetadata).toEqual({ sold: 'true', hash: 'v2' })
    expect(meta.name).toBe('1.html')
  })

  it("a missing file throws Firebase's not-found code", async () => {
    const { storage } = store(() => reply(404))
    await expect(storage.url('people/+1/none.html')).rejects.toMatchObject({
      code: 'storage/object-not-found'
    })
  })

  it('directory answers in items and prefixes', async () => {
    const { storage } = store(() =>
      reply(200, {
        body: JSON.stringify({ files: ['1.html'], folders: ['2026'] })
      })
    )
    const listed = await storage.directory('people/+1/posters')
    expect(listed.items).toEqual([
      { fullPath: 'people/+1/posters/1.html', name: '1.html' }
    ])
    expect(listed.prefixes).toEqual([
      { fullPath: 'people/+1/posters/2026/', name: '2026' }
    ])
  })

  it('move copies bytes and meta, then deletes the source', async () => {
    const { calls, storage } = store((url, init) =>
      init.method === 'GET'
        ? reply(200, { body: 'p', headers: { 'x-meta-sold': 'true' } })
        : reply(init.method === 'DELETE' ? 204 : 200)
    )
    expect(await storage.move('a/1.html', 'a/2026/1.html')).toBe(true)
    expect(calls.map(call => call.method)).toEqual(['GET', 'PUT', 'DELETE'])
    expect(calls[1].headers['x-meta-sold']).toBe('true')
  })

  it('a move whose delete fails takes the copy back', async () => {
    const { calls, storage } = store((url, init) =>
      init.method === 'DELETE' && url.endsWith('a/1.html')
        ? reply(500)
        : reply(200, { body: 'p' })
    )
    expect(await storage.move('a/1.html', 'b/1.html')).toBe(false)
    expect(calls.at(-1)).toMatchObject({
      method: 'DELETE',
      url: '/sync/b/1.html'
    })
  })

  it('fetch_file signs the read in', async () => {
    const { calls, storage } = store(() => reply(200))
    await storage.fetch_file('/sync/people/%2B1/a.html')
    expect(calls[0].headers).toEqual({ authorization: 'Bearer tok' })
  })

  it('a refused write reads as storage/unauthorized; other failures name the status', async () => {
    const { storage } = store(url => reply(url.includes('sold') ? 403 : 500))
    await expect(storage.upload('a/sold.html', 'x')).rejects.toMatchObject({
      code: 'storage/unauthorized'
    })
    await expect(storage.metadata('a/b.html')).rejects.toThrow(/500/)
    await expect(storage.directory('a')).rejects.toThrow(/500/)
  })

  it('remove takes a missing file as already gone, and throws on a failure', async () => {
    const statuses = [204, 404, 500]
    const { calls, storage } = store(() => reply(statuses.shift()))
    await storage.remove('a/1.html')
    await storage.remove('a/1.html')
    await expect(storage.remove('a/1.html')).rejects.toThrow(/500/)
    expect(calls.every(call => call.method === 'DELETE')).toBe(true)
  })

  it('a move stops when the read or the copy fails', async () => {
    const reads = store(() => reply(404))
    expect(await reads.storage.move('a/1.html', 'b/1.html')).toBe(false)
    expect(reads.calls).toHaveLength(1)

    const copies = store((url, init) =>
      init.method === 'GET' ? reply(200, { body: 'p' }) : reply(500)
    )
    expect(await copies.storage.move('a/1.html', 'b/1.html')).toBe(false)
    expect(copies.calls.map(call => call.method)).toEqual(['GET', 'PUT'])
  })

  it('signed out, calls go without a bearer', async () => {
    const calls = []
    globalThis.fetch = vi.fn(async (url, init = {}) => {
      calls.push(init)
      return reply(200, { headers: { etag: '"v"' } })
    })
    const storage = sync_storage({ base: '/sync/', token: async () => null })
    expect(await storage.url('a/1.html')).toBe('/sync/a/1.html')
    await storage.fetch_file('/sync/a/1.html')
    expect(calls.map(call => call.headers)).toEqual([{}, {}])
  })
})
