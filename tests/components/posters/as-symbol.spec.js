import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import AsSymbol from '@/components/posters/as-symbol.vue'

const itemid = '/+14151234356/boulders/1000'

const { mock_get, mock_load_from_cache, mock_hydrate } = vi.hoisted(() => ({
  mock_get: vi.fn(),
  mock_load_from_cache: vi.fn(),
  mock_hydrate: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: mock_get,
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  clear: vi.fn()
}))

vi.mock('@/utils/itemid', () => ({
  load_from_cache: mock_load_from_cache
}))

vi.mock('@/utils/item', () => ({
  hydrate: mock_hydrate
}))

const symbol_html = `<symbol id="sym-1" itemid="${itemid}" viewBox="0 0 8 8"><path d="M1 1"/></symbol>`

describe('@/components/posters/as-symbol', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_get.mockResolvedValue(null)
    mock_load_from_cache.mockResolvedValue({ html: null })
    mock_hydrate.mockReturnValue(null)
  })

  it('loads symbol markup from idb and sets attributes', async () => {
    mock_get.mockResolvedValue(symbol_html)
    const fragment = {
      querySelector: () => ({
        innerHTML: '<path d="M1 1"/>',
        id: 'sym-1',
        getAttribute: name => (name === 'viewBox' ? '0 0 8 8' : null)
      })
    }
    mock_hydrate.mockReturnValue(fragment)

    const wrapper = shallowMount(AsSymbol, { props: { itemid } })
    await flushPromises()

    const symbol = wrapper.find('symbol')
    expect(symbol.attributes('id')).toBe('sym-1')
    expect(symbol.attributes('viewbox')).toBe('0 0 8 8')
    expect(symbol.attributes('itemid')).toBe(itemid)
    expect(symbol.element.innerHTML).toContain('<path d="M1 1">')
    expect(mock_load_from_cache).not.toHaveBeenCalled()
  })

  it('falls back to load_from_cache when idb is empty', async () => {
    mock_get.mockResolvedValue(null)
    mock_load_from_cache.mockResolvedValue({ html: symbol_html })
    mock_hydrate.mockReturnValue({
      querySelector: () => ({
        innerHTML: '<circle r="1"/>',
        id: '',
        getAttribute: () => null
      })
    })

    const wrapper = shallowMount(AsSymbol, { props: { itemid } })
    await flushPromises()

    expect(mock_load_from_cache).toHaveBeenCalledWith(itemid)
    expect(wrapper.find('symbol').attributes('id')).toBe(itemid)
    expect(wrapper.find('symbol').element.innerHTML).toContain('<circle r="1">')
  })

  it('leaves the symbol empty when cache has no html', async () => {
    const wrapper = shallowMount(AsSymbol, { props: { itemid } })
    await flushPromises()
    expect(wrapper.find('symbol').attributes('id')).toBe('')
  })
})
