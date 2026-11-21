import { describe, expect, it, vi, beforeEach } from 'vitest'
import { get } from 'idb-keyval'
import { load_from_cache } from '@/utils/itemid'
import { load_shadow_into_vector } from '@/utils/poster-layers'

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn(),
  del: vi.fn()
}))

vi.mock('@/utils/itemid', async importOriginal => {
  const mod = await importOriginal()
  return {
    ...mod,
    load_from_cache: vi.fn().mockResolvedValue({ item: null, html: null })
  }
})

describe('load_shadow_into_vector', () => {
  beforeEach(() => {
    vi.mocked(get).mockResolvedValue(null)
    vi.mocked(load_from_cache).mockResolvedValue({ item: null, html: null })
  })

  it('returns vector unchanged when regular is already present', async () => {
    const vector = {
      id: '/+1/posters/1',
      regular: true
    }
    const result = await load_shadow_into_vector(
      /** @type {import('@/types').Poster} */ (vector),
      '/+1/posters/1'
    )
    expect(result.regular).toBe(true)
    expect(load_from_cache).not.toHaveBeenCalled()
  })

  it('fills paths from inline poster html when shadows file is missing', async () => {
    const poster_id = '/+1/posters/1'
    const inline_html = `<svg itemscope itemid="${poster_id}" itemtype="/posters" viewBox="0 0 10 10" width="10" height="10"><path itemprop="light" d="M0 0"/><path itemprop="regular" d="M0 1"/><path itemprop="medium" d="M0 2"/><path itemprop="bold" d="M0 3"/><rect itemprop="background" width="10" height="10"/></svg>`
    vi.mocked(get).mockImplementation(async key => {
      if (key === poster_id) return inline_html
      return null
    })

    const result = await load_shadow_into_vector(
      {
        id: poster_id,
        viewbox: '0 0 10 10',
        width: '10',
        height: '10'
      },
      poster_id
    )

    expect(result.regular).toBeTruthy()
    expect(result.light).toBeTruthy()
  })

  it('takes only the layers a cached shadows item has', async () => {
    const poster_id = '/+1/posters/1799999999990'
    vi.mocked(load_from_cache).mockImplementation(async id =>
      id.includes('/shadows/')
        ? { item: { regular: 'M0 1' }, html: null }
        : { item: null, html: null }
    )
    const vector = { id: poster_id, light: 'kept' }
    const result = await load_shadow_into_vector(
      /** @type {import('@/types').Poster} */ (vector),
      poster_id
    )
    expect(result.regular).toBe('M0 1')
    expect(result.light).toBe('kept')
    expect(result.bold).toBeUndefined()
  })

  it('a new poster reads its shadows from a cached shadows page', async () => {
    const poster_id = '/+1/posters/1799999999991'
    const shadow_id = '/+1/shadows/1799999999991'
    const shadow_html = `<svg itemscope itemid="${shadow_id}" itemtype="/shadows"><path itemprop="bold" d="M0 3"/></svg>`
    vi.mocked(load_from_cache).mockImplementation(async id =>
      id === shadow_id
        ? { item: null, html: shadow_html }
        : { item: null, html: null }
    )
    const result = await load_shadow_into_vector(
      /** @type {import('@/types').Poster} */ ({ id: poster_id }),
      poster_id
    )
    expect(result.bold).toBeTruthy()
  })

  it('a new poster with no shadows reads its own cached copy', async () => {
    const poster_id = '/+1/posters/1799999999992'
    const inline_html = `<svg itemscope itemid="${poster_id}" itemtype="/posters" viewBox="0 0 10 10" width="10" height="10"><path itemprop="medium" d="M0 2"/></svg>`
    vi.mocked(load_from_cache).mockImplementation(async id =>
      id === poster_id
        ? { item: null, html: inline_html }
        : { item: null, html: null }
    )
    const result = await load_shadow_into_vector(
      /** @type {import('@/types').Poster} */ ({ id: poster_id }),
      poster_id
    )
    expect(result.medium).toBeTruthy()
  })

  it('an old poster reads its layers from the cached copy', async () => {
    const poster_id = '/+1/posters/1000'
    const inline_html = `<svg itemscope itemid="${poster_id}" itemtype="/posters" viewBox="0 0 10 10" width="10" height="10"><path itemprop="regular" d="M0 1"/></svg>`
    vi.mocked(load_from_cache).mockResolvedValue({
      item: null,
      html: inline_html
    })
    const result = await load_shadow_into_vector(
      /** @type {import('@/types').Poster} */ ({ id: poster_id }),
      poster_id
    )
    expect(result.regular).toBeTruthy()
    expect(result.light).toBeUndefined()
  })

  it('an old poster with nothing stored stays as it was', async () => {
    const poster_id = '/+1/posters/1000'
    const vector = { id: poster_id }
    const result = await load_shadow_into_vector(
      /** @type {import('@/types').Poster} */ (vector),
      poster_id
    )
    expect(result).toBe(vector)
    expect(result.regular).toBeUndefined()
  })

  it('a new poster with nothing stored stays as it was', async () => {
    const poster_id = '/+1/posters/1799999999999'
    const vector = { id: poster_id }
    const result = await load_shadow_into_vector(
      /** @type {import('@/types').Poster} */ (vector),
      poster_id
    )
    expect(result).toBe(vector)
  })
})
