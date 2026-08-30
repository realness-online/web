import { describe, expect, it, vi, beforeEach } from 'vitest'
import { get } from 'idb-keyval'
import { load_from_cache, as_created_at } from '@/utils/itemid'
import {
  load_cutout_flags,
  collect_geology_paths,
  find_geology_symbol,
  GEOLOGY_DATE
} from '@/utils/geology'

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
  return {
    ...actual,
    is_inline_poster_html: vi.fn(() => false),
    cutout_flags_from_html: vi.fn(() => ({}))
  }
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

describe('collect_geology_paths', () => {
  it('returns nothing when symbol_defs is absent', () => {
    expect(collect_geology_paths(null, itemid)).toEqual([])
    expect(collect_geology_paths(undefined, itemid)).toEqual([])
  })

  it('collects layer paths with their d and transform', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<symbol itemid="/+1/sediment/9"><path d="M0 0"></path><path d="M5 5" transform="rotate(10)"></path></symbol>' +
      '<symbol itemid="/+1/sand/9"><path d="M1 1"></path></symbol>'

    const data = collect_geology_paths(root, itemid)
    expect(data).toEqual([
      { key: 'sediment:0', d: 'M0 0' },
      {
        key: 'sediment:1',
        d: 'M5 5',
        transform: 'rotate(10)'
      },
      { key: 'sand:0', d: 'M1 1' }
    ])
  })

  it('skips symbols without matching layers and paths without a d', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<symbol itemid="/+1/unlisted/9"><path d="M1 1"></path></symbol>' +
      '<symbol itemid="/+1/rocks/9"><path></path></symbol>'
    expect(collect_geology_paths(root, itemid)).toEqual([])
  })

  it('finds a single layer symbol by id', () => {
    const root = document.createElement('div')
    root.innerHTML = '<symbol itemid="/+1/gravel/9"></symbol>'
    expect(find_geology_symbol(root, itemid, 'gravel')).not.toBeNull()
    expect(find_geology_symbol(root, itemid, 'sand')).toBeNull()
  })
})

describe('load_cutout_flags inline & old-style', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // contents differ per test
  })

  it('returns an empty set for old-style posters before the split cutoff', async () => {
    vi.mocked(as_created_at).mockReturnValue(GEOLOGY_DATE - 1)
    expect(await load_cutout_flags(itemid)).toEqual({})
    expect(get).not.toHaveBeenCalled()
  })
})
