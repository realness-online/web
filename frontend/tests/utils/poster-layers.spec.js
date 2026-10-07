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
})
