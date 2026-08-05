import { describe, expect, it, vi, beforeEach } from 'vitest'
import { get } from 'idb-keyval'
import { load_from_cache } from '@/utils/itemid'
import { load_cutout_flags, GEOLOGY_DATE } from '@/utils/geology'

vi.mock('idb-keyval', () => ({ get: vi.fn() }))

vi.mock('@/utils/itemid', () => ({
  load_from_cache: vi.fn(async () => ({ item: null, html: null })),
  as_layer_id: vi.fn((itemid, layer) => `/+1/${layer}/9`),
  as_created_at: vi.fn(() => 1770000000000)
}))

vi.mock('@/use/poster', () => ({
  geology_layers: ['sediment', 'sand', 'gravel', 'rocks', 'boulders']
}))

vi.mock('@/utils/poster-format', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, is_inline_poster_html: () => false }
})

const itemid = '/+1/posters/9'
const empty_layer = layer =>
  `<symbol itemid="/+1/${layer}/9" viewBox="0 0 512 683"></symbol>`
const filled_layer = layer =>
  `<symbol itemid="/+1/${layer}/9" viewBox="0 0 512 683"><path d="M0 0"/></symbol>`

describe('load_cutout_flags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(load_from_cache).mockResolvedValue({ item: null, html: null })
  })

  it('is a poster created after the split-layer cutoff', () => {
    expect(1770000000000).toBeGreaterThan(GEOLOGY_DATE)
  })

  it('does not report a layer whose symbol wraps nothing', async () => {
    // These files exist in storage — save_poster used to persist the empty
    // shell as-symbol renders before content arrives. Reporting them present
    // makes wait_for_poster_symbols block until it times out.
    vi.mocked(get).mockImplementation(async id => {
      if (id === '/+1/rocks/9') return filled_layer('rocks')
      if (id === '/+1/sand/9') return empty_layer('sand')
      return null
    })

    const flags = await load_cutout_flags(itemid)

    expect(flags.rocks).toBe(true)
    expect(flags.sand).toBeUndefined()
  })

  it('falls through to the network when the local copy is empty', async () => {
    vi.mocked(get).mockImplementation(async id =>
      id === '/+1/gravel/9' ? empty_layer('gravel') : null
    )
    vi.mocked(load_from_cache).mockImplementation(async id =>
      id === '/+1/gravel/9'
        ? { item: null, html: filled_layer('gravel') }
        : { item: null, html: null }
    )

    const flags = await load_cutout_flags(itemid)

    expect(flags.gravel).toBe(true)
  })
})
