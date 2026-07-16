import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import AsPosterSymbol from '@/components/posters/as-poster-symbol.vue'

const { prefs } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return {
    prefs: {
      mosaic: create_ref(true),
      boulders: create_ref(true),
      rocks: create_ref(true),
      gravel: create_ref(false),
      sand: create_ref(false),
      sediment: create_ref(false)
    }
  }
})

vi.mock('@/utils/preference', () => prefs)

vi.mock('@/utils/itemid', () => ({
  as_layer_id: (poster_id, layer) => `${poster_id}/${layer}`
}))

const itemid = '/+14151234356/posters/1000'

const mount = (props = {}) =>
  shallowMount(AsPosterSymbol, {
    props: {
      itemid,
      shown: true,
      vector: {
        cutouts: { boulders: true, rocks: true, gravel: true }
      },
      ...props
    },
    global: {
      stubs: {
        'as-symbol': true,
        'as-symbol-shadow': true
      }
    }
  })

describe('@/components/posters/as-poster-symbol', () => {
  beforeEach(() => {
    prefs.mosaic.value = true
    prefs.boulders.value = true
    prefs.rocks.value = true
    prefs.gravel.value = false
    prefs.sand.value = false
    prefs.sediment.value = false
  })

  it('renders nothing when not shown', () => {
    const wrapper = mount({ shown: false })
    expect(wrapper.find('svg[data-poster-symbol-defs]').exists()).toBe(false)
  })

  it('renders shadow and enabled cutout symbols when shown', () => {
    const wrapper = mount()
    expect(wrapper.find('svg[data-poster-symbol-defs]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'as-symbol-shadow' }).exists()).toBe(
      true
    )
    const symbols = wrapper.findAllComponents({ name: 'as-symbol' })
    expect(symbols).toHaveLength(2)
    expect(symbols[0].props('itemid')).toBe(`${itemid}/boulders`)
    expect(symbols[1].props('itemid')).toBe(`${itemid}/rocks`)
  })

  it('honors show_cutout_symbols over mosaic', () => {
    prefs.mosaic.value = true
    const wrapper = mount({ show_cutout_symbols: false })
    expect(wrapper.findAllComponents({ name: 'as-symbol' })).toHaveLength(0)
  })
})
