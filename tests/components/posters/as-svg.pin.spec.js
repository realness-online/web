import { shallowMount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import as_svg from '@/components/posters/as-svg'

const itemid = '/+16282281824/posters/559666932867'

/** @returns {Record<string, unknown>} */
const vector_fixture = () => ({
  id: itemid,
  type: 'posters',
  viewbox: '0 0 400 200',
  width: '400',
  height: '200',
  regular: true,
  cutouts: {
    sediment: true,
    sand: true,
    gravel: false,
    rocks: false,
    boulders: false
  }
})

const {
  mock_slice_alignment,
  mock_aspect_ratio_mode,
  mock_mosaic,
  mock_storytelling,
  mock_drama_back,
  mock_drama_front,
  mock_shadow,
  mock_stroke,
  mock_animate_pref,
  mock_boulders,
  mock_rocks,
  mock_gravel,
  mock_sand,
  mock_sediment
} = vi.hoisted(() => {
  const create_watchable = value =>
    Object.assign({ value }, { __v_isRef: true })
  return {
    mock_slice_alignment: create_watchable('ymid'),
    mock_aspect_ratio_mode: create_watchable('auto'),
    mock_mosaic: create_watchable(true),
    mock_storytelling: create_watchable(false),
    mock_drama_back: create_watchable(false),
    mock_drama_front: create_watchable(false),
    mock_shadow: create_watchable(true),
    mock_stroke: create_watchable(false),
    mock_animate_pref: create_watchable(false),
    mock_boulders: create_watchable(true),
    mock_rocks: create_watchable(true),
    mock_gravel: create_watchable(true),
    mock_sand: create_watchable(true),
    mock_sediment: create_watchable(true)
  }
})

vi.mock('@/utils/preference', () => ({
  slice_alignment: mock_slice_alignment,
  aspect_ratio_mode: mock_aspect_ratio_mode,
  mosaic: mock_mosaic,
  storytelling: mock_storytelling,
  drama_back: mock_drama_back,
  drama_front: mock_drama_front,
  shadow: mock_shadow,
  stroke: mock_stroke,
  animate: mock_animate_pref,
  boulders: mock_boulders,
  rocks: mock_rocks,
  gravel: mock_gravel,
  sand: mock_sand,
  sediment: mock_sediment
}))

vi.mock('@vueuse/core', async importOriginal => {
  const mod = await importOriginal()
  return {
    ...mod,
    /** Hero off-screen: first callback is not intersecting. */
    useIntersectionObserver: (_target, cb) => {
      queueMicrotask(() => {
        cb([{ isIntersecting: false }])
      })
      return { stop: vi.fn() }
    }
  }
})

vi.mock('@/utils/itemid', async importOriginal => {
  const mod = await importOriginal()
  return {
    ...mod,
    load: vi.fn(async () => vector_fixture())
  }
})

describe('@/components/posters/as-svg.vue pin', () => {
  beforeEach(() => {
    mock_mosaic.value = true
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: String(query).includes('portrait'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps g.cutouts in the tree when pin and intersection reports false', async () => {
    const wrapper = shallowMount(as_svg, {
      props: {
        itemid,
        pin: true,
        show_cutout_layers: true
      }
    })
    await flushPromises()
    expect(wrapper.find('g.cutouts').exists()).toBe(true)
  })

  it('without pin, removes cutouts when intersection reports false', async () => {
    const wrapper = shallowMount(as_svg, {
      props: {
        itemid,
        pin: false,
        show_cutout_layers: true
      }
    })
    await flushPromises()
    expect(wrapper.find('g.cutouts').exists()).toBe(false)
  })
})
