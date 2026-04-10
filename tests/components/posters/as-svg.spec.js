import { shallowMount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import as_svg from '@/components/posters/as-svg'

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
  const create_ref = value => ({ value })
  const create_watchable = value =>
    Object.assign(create_ref(value), { __v_isRef: true })
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

const itemid = '/+16282281824/posters/559666932867'

/** @returns {Record<string, unknown>} */
const vector_fixture = (overrides = {}) => ({
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
  },
  ...overrides
})

describe('@/components/posters/as-svg.vue', () => {
  let match_media_impl

  beforeEach(() => {
    mock_slice_alignment.value = 'ymid'
    mock_aspect_ratio_mode.value = 'auto'
    mock_mosaic.value = true
    mock_storytelling.value = false
    mock_drama_back.value = false
    mock_drama_front.value = false
    mock_shadow.value = true
    mock_stroke.value = false
    mock_animate_pref.value = false
    mock_boulders.value = true
    mock_rocks.value = true
    mock_gravel.value = true
    mock_sand.value = true
    mock_sediment.value = true

    match_media_impl = query => ({
      matches: String(query).includes('portrait'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
    vi.spyOn(window, 'matchMedia').mockImplementation(match_media_impl)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Renders', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    it('A working icon initially', () => {
      const wrapper = shallowMount(as_svg, { props: { itemid } })
      expect(wrapper.element).toMatchSnapshot()
    })

    it('with sync_poster shows vector viewBox and cutouts', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const svg = wrapper.find('svg')
      expect(svg.attributes('viewBox')).toBe('0 0 400 200')
      expect(svg.attributes('preserveAspectRatio')).toContain('slice')
      expect(wrapper.find('g.cutouts').exists()).toBe(true)
    })
  })

  describe('preserveAspectRatio', () => {
    it('uses slice_alignment ymin', async () => {
      mock_slice_alignment.value = 'ymin'
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const svg = wrapper.find('svg')
      expect(svg.attributes('preserveAspectRatio')).toBe('xMidYMin slice')
    })

    it('uses slice_alignment ymax', async () => {
      mock_slice_alignment.value = 'ymax'
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      expect(wrapper.find('svg').attributes('preserveAspectRatio')).toBe(
        'xMidYMax slice'
      )
    })

    it('toggle_meet switches to meet then back to slice', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      /** @type {{ toggle_meet: () => void }} */
      const vm = wrapper.vm
      expect(wrapper.find('svg').attributes('preserveAspectRatio')).toContain(
        'slice'
      )
      vm.toggle_meet()
      await flushPromises()
      expect(wrapper.find('svg').attributes('preserveAspectRatio')).toBe(
        'xMidYMid meet'
      )
      vm.toggle_meet()
      await flushPromises()
      expect(wrapper.find('svg').attributes('preserveAspectRatio')).toContain(
        'slice'
      )
    })
  })

  describe('sync_poster', () => {
    it('emits in_view and show when sync_poster is set', async () => {
      const v = vector_fixture()
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: v }
      })
      await flushPromises()
      expect(wrapper.emitted('in_view')?.[0]).toEqual([true])
      expect(wrapper.emitted('show')?.[0]).toEqual([v])
    })

    it('clears vector when sync_poster becomes null', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      expect(wrapper.find('as-animation-stub').exists()).toBe(true)
      await wrapper.setProps({ sync_poster: null })
      await flushPromises()
      expect(wrapper.find('as-animation-stub').exists()).toBe(false)
    })
  })

  describe('poster slice and storytelling', () => {
    it('sets svg aspectRatio style when slice and aspect_ratio_mode not auto', async () => {
      mock_aspect_ratio_mode.value = '16 / 9'
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          slice: true,
          sync_poster: vector_fixture()
        }
      })
      await flushPromises()
      const style = wrapper.find('svg').attributes('style') ?? ''
      expect(style).toContain('aspect-ratio')
    })

    it('adds hide-cursor when slice and storytelling', async () => {
      mock_storytelling.value = true
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          slice: true,
          sync_poster: vector_fixture()
        }
      })
      await flushPromises()
      expect(wrapper.find('svg').classes()).toContain('hide-cursor')
    })
  })

  describe('show_cutout_layers', () => {
    it('overrides mosaic when set', async () => {
      mock_mosaic.value = false
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          sync_poster: vector_fixture(),
          show_cutout_layers: true
        }
      })
      await flushPromises()
      const cutouts = wrapper.find('g.cutouts')
      expect(cutouts.exists()).toBe(true)
    })
  })

  describe('landscape', () => {
    it('sets landscape class for wide viewbox', async () => {
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          sync_poster: vector_fixture({ viewbox: '0 0 500 200' })
        }
      })
      await flushPromises()
      expect(wrapper.find('svg').classes()).toContain('landscape')
    })
  })

  describe('lightbars', () => {
    it('shows lightbars when drama prefs on', async () => {
      mock_drama_back.value = true
      mock_drama_front.value = true
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const backs = wrapper.find('#lightbar-back')
      expect(backs.attributes('style')).toContain('opacity: 1')
    })
  })

  describe('pan_delegator', () => {
    it('registers and unregisters with provider', async () => {
      const unregister = vi.fn()
      const pan_delegator = {
        register: vi.fn(() => ({
          pan_offset: ref(0),
          panning: ref(false),
          was_pan_gesture: ref(false),
          unregister
        }))
      }
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() },
        global: { provide: { pan_delegator } }
      })
      await flushPromises()
      expect(pan_delegator.register).toHaveBeenCalled()
      wrapper.unmount()
      expect(unregister).toHaveBeenCalled()
    })

    it('applies pan transform when portrait and pannable', async () => {
      const pan_offset = ref(12)
      const panning = ref(false)
      const pan_delegator = {
        register: vi.fn(() => ({
          pan_offset,
          panning,
          was_pan_gesture: ref(false),
          unregister: vi.fn()
        }))
      }
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          sync_poster: vector_fixture({ viewbox: '0 0 800 200' })
        },
        global: { provide: { pan_delegator } }
      })
      await flushPromises()
      const inner_g = wrapper.find('svg g')
      const style = inner_g.attributes('style') ?? ''
      expect(style).toContain('translateX(12px)')
    })
  })

  describe('pointer and click', () => {
    it('emits click on quick pointerup', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const svg = wrapper.find('svg')
      await svg.trigger('pointerdown', { pointerType: 'mouse' })
      await svg.trigger('pointerup', { pointerType: 'mouse' })
      expect(wrapper.emitted('click')?.[0]).toEqual([true])
    })

    it('does not emit click on quick touch pointerup', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const svg = wrapper.find('svg')
      await svg.trigger('pointerdown', { pointerType: 'touch' })
      await svg.trigger('pointerup', { pointerType: 'touch' })
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('emits click on quick touch when touch_uses_long_press is false', async () => {
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          sync_poster: vector_fixture(),
          touch_uses_long_press: false
        }
      })
      await flushPromises()
      const svg = wrapper.find('svg')
      await svg.trigger('pointerdown', { pointerType: 'touch' })
      await svg.trigger('pointerup', { pointerType: 'touch' })
      expect(wrapper.emitted('click')?.[0]).toEqual([true])
    })

    it('emits click after touch long press', async () => {
      vi.useFakeTimers()
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() },
        attachTo: document.body
      })
      try {
        await flushPromises()
        const svg = wrapper.find('svg')
        await svg.trigger('pointerdown', { pointerType: 'touch' })
        vi.advanceTimersByTime(450)
        await flushPromises()
        expect(wrapper.emitted('click')?.[0]).toEqual([true])
        await svg.trigger('pointerup', { pointerType: 'touch' })
      } finally {
        vi.useRealTimers()
        wrapper.unmount()
      }
    })

    it('cancels touch long press when pointer moves', async () => {
      vi.useFakeTimers()
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() },
        attachTo: document.body
      })
      try {
        await flushPromises()
        const svg_el = wrapper.find('svg').element
        svg_el.dispatchEvent(
          new PointerEvent('pointerdown', {
            pointerType: 'touch',
            clientX: 100,
            clientY: 100,
            bubbles: true
          })
        )
        svg_el.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerType: 'touch',
            clientX: 120,
            clientY: 100,
            bubbles: true
          })
        )
        vi.advanceTimersByTime(450)
        await flushPromises()
        expect(wrapper.emitted('click')).toBeFalsy()
      } finally {
        vi.useRealTimers()
        wrapper.unmount()
      }
    })

    it('does not emit click when pointer leaves before up', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const svg = wrapper.find('svg')
      await svg.trigger('pointerdown')
      await svg.trigger('pointerleave')
      await svg.trigger('pointerup')
      expect(wrapper.emitted('click')).toBeFalsy()
    })

    it('sets data-held-layer after hold on shadow use', async () => {
      vi.useFakeTimers()
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() },
        attachTo: document.body
      })
      try {
        await flushPromises()
        const shadow_use = wrapper.find('use[itemprop="shadow"]')
        shadow_use.element.dispatchEvent(
          new Event('pointerdown', { bubbles: true })
        )
        vi.advanceTimersByTime(250)
        await flushPromises()
        expect(wrapper.find('svg').attributes('data-held-layer')).toBe('shadow')
      } finally {
        vi.useRealTimers()
        wrapper.unmount()
      }
    })
  })
})
