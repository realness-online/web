import { shallowMount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
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
  mock_morph_pref,
  mock_boulders,
  mock_rocks,
  mock_gravel,
  mock_sand,
  mock_sediment,
  mock_grid,
  mock_background,
  mock_light,
  mock_regular,
  mock_medium,
  mock_bold,
  mock_as_animation_morph
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
    mock_morph_pref: create_watchable(false),
    mock_boulders: create_watchable(true),
    mock_rocks: create_watchable(true),
    mock_gravel: create_watchable(true),
    mock_sand: create_watchable(true),
    mock_sediment: create_watchable(true),
    mock_grid: create_watchable(false),
    mock_background: create_watchable(true),
    mock_light: create_watchable(true),
    mock_regular: create_watchable(true),
    mock_medium: create_watchable(true),
    mock_bold: create_watchable(true),
    mock_as_animation_morph: create_watchable(false)
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
  morph: mock_morph_pref,
  boulders: mock_boulders,
  rocks: mock_rocks,
  gravel: mock_gravel,
  sand: mock_sand,
  sediment: mock_sediment,
  grid: mock_grid,
  background: mock_background,
  light: mock_light,
  regular: mock_regular,
  medium: mock_medium,
  bold: mock_bold
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
    mock_morph_pref.value = false
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
      expect(wrapper.find('use[itemprop="sediment"]').exists()).toBe(true)
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
    it('emits intersecting and show when sync_poster is set', async () => {
      const v = vector_fixture()
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: v }
      })
      await flushPromises()
      expect(wrapper.emitted('intersecting')?.[0]).toEqual([true])
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
    it('sets data-aspect when slice and aspect_ratio_mode not auto', async () => {
      mock_aspect_ratio_mode.value = '16/9'
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          slice: true,
          sync_poster: vector_fixture()
        }
      })
      await flushPromises()
      expect(wrapper.find('svg').attributes('data-aspect')).toBe('16/9')
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
      expect(wrapper.find('svg').attributes('data-hide-cursor')).toBe('true')
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
      const cutouts = wrapper.find('use[itemprop="sediment"]')
      expect(cutouts.exists()).toBe(true)
    })
  })

  describe('cutout opacity and morph mask', () => {
    it('rests cutouts at 0.5 with no mask while morph is off', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const cutout = wrapper.find('use[itemprop="sediment"]')
      expect(cutout.attributes('style')).toContain('opacity: 0.5')
      expect(cutout.element.parentElement.getAttribute('mask')).toBe(null)
    })

    it('raises cutouts to 0.85 and masks the group while morphing', async () => {
      mock_animate_pref.value = true
      mock_morph_pref.value = true
      mock_as_animation_morph.value = true
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() },
        global: {
          stubs: {
            AsAnimation: {
              name: 'AsAnimation',
              setup: () => ({ morph_active: mock_as_animation_morph })
            }
          }
        }
      })
      await flushPromises()
      const cutout = wrapper.find('use[itemprop="sediment"]')
      // Above resting 0.5 (the morph opacity is a tuned constant).
      expect(cutout.attributes('style')).not.toContain('opacity: 0.5')
      expect(cutout.element.parentElement.getAttribute('mask')).toMatch(
        /url\(.+cutout-shadow-dim\)/
      )
    })

    it('rests cutouts when as-animation reports morph is not running', async () => {
      mock_animate_pref.value = true
      mock_morph_pref.value = true
      mock_as_animation_morph.value = false
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() },
        global: {
          stubs: {
            AsAnimation: {
              name: 'AsAnimation',
              setup: () => ({ morph_active: mock_as_animation_morph })
            }
          }
        }
      })
      await flushPromises()
      const cutout = wrapper.find('use[itemprop="sediment"]')
      // morph is off (wind-down over, prefs on) but morph_pref on alone is not
      // enough - cutouts stay at rest until the animation actually runs.
      expect(cutout.attributes('style')).toContain('opacity: 0.5')
      expect(cutout.element.parentElement.getAttribute('mask')).toBe(null)
    })

    it('keeps cutouts unmasked and raised when shadow is hidden', async () => {
      mock_shadow.value = false
      mock_animate_pref.value = true
      mock_morph_pref.value = true
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      const cutout = wrapper.find('use[itemprop="sediment"]')
      expect(cutout.attributes('style')).toContain('--layer-opacity: 0.8')
      expect(cutout.element.parentElement.getAttribute('mask')).toBe(null)
    })
  })

  describe('as_avatar', () => {
    it('does not add animate class when used as avatar even if animate pref is on', async () => {
      mock_animate_pref.value = true
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          as_avatar: true,
          sync_poster: vector_fixture()
        }
      })
      await flushPromises()
      expect(wrapper.find('svg').classes()).not.toContain('animate')
    })
  })

  describe('landscape', () => {
    it('sets aria-orientation horizontal for wide viewbox', async () => {
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          sync_poster: vector_fixture({ viewbox: '0 0 500 200' })
        }
      })
      await flushPromises()
      expect(wrapper.find('svg').attributes('data-orientation')).toBe(
        'horizontal'
      )
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

    it('does not pan a portrait poster, which already fits the frame', async () => {
      const pan_delegator = {
        register: vi.fn(() => ({
          pan_offset: ref(12),
          panning: ref(false),
          was_pan_gesture: ref(false),
          unregister: vi.fn()
        }))
      }
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          sync_poster: vector_fixture({ viewbox: '0 0 200 800' })
        },
        global: { provide: { pan_delegator } }
      })
      await flushPromises()
      const style = wrapper.find('svg g').attributes('style') ?? ''
      expect(style).not.toContain('translateX')
    })

    it('drops the pan transform while the 3D canvas owns the poster', async () => {
      const pan_delegator = {
        register: vi.fn(() => ({
          pan_offset: ref(12),
          panning: ref(false),
          was_pan_gesture: ref(false),
          unregister: vi.fn()
        }))
      }
      const wrapper = shallowMount(as_svg, {
        props: {
          itemid,
          sync_poster: vector_fixture({ viewbox: '0 0 800 200' }),
          behind_canvas: true
        },
        global: { provide: { pan_delegator } }
      })
      await flushPromises()
      const style = wrapper.find('svg g').attributes('style') ?? ''
      expect(style).not.toContain('translateX')
    })
  })

  describe('contextmenu', () => {
    it('leaves the mouse menu alone, but blocks it behind the 3D canvas', async () => {
      const mouse_down = { pointerType: 'mouse', clientX: 0, clientY: 0 }

      const flat = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      await flat.find('svg').trigger('pointerdown', mouse_down)
      const menu = { preventDefault: vi.fn() }
      await flat.find('svg').trigger('contextmenu', menu)
      expect(menu.preventDefault).not.toHaveBeenCalled()

      const behind = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture(), behind_canvas: true }
      })
      await flushPromises()
      await behind.find('svg').trigger('pointerdown', mouse_down)
      const blocked = { preventDefault: vi.fn() }
      await behind.find('svg').trigger('contextmenu', blocked)
      expect(blocked.preventDefault).toHaveBeenCalled()
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

    it('touch slice toggles when long-press timer fires (not again on pointerup)', async () => {
      vi.useFakeTimers({ now: 10_000 })
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
        vi.advanceTimersByTime(499)
        await flushPromises()
        expect(wrapper.emitted('click')).toBeFalsy()

        vi.advanceTimersByTime(1)
        await flushPromises()
        expect(wrapper.emitted('click')?.[0]).toEqual([true])

        svg_el.dispatchEvent(
          new PointerEvent('pointerup', {
            pointerType: 'touch',
            bubbles: true
          })
        )
        await flushPromises()
        expect(wrapper.emitted('click')?.length).toBe(1)
      } finally {
        vi.useRealTimers()
        wrapper.unmount()
      }
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

    it('cancels click when touch slides before pointerup', async () => {
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
        svg_el.dispatchEvent(
          new PointerEvent('pointerup', {
            pointerType: 'touch',
            bubbles: true
          })
        )
        await flushPromises()
        expect(wrapper.emitted('click')).toBeFalsy()
      } finally {
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

    it('sets data-held-layer on pointerdown on shadow use', async () => {
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
        await flushPromises()
        expect(wrapper.find('svg').attributes('data-held-layer')).toBe('shadow')
      } finally {
        wrapper.unmount()
      }
    })

    it('does not set data-held-layer on touch pointerdown when touch uses slide guard', async () => {
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() },
        attachTo: document.body
      })
      try {
        await flushPromises()
        const shadow_use = wrapper.find('use[itemprop="shadow"]')
        shadow_use.element.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            pointerType: 'touch',
            clientX: 100,
            clientY: 100
          })
        )
        await flushPromises()
        expect(
          wrapper.find('svg').attributes('data-held-layer')
        ).toBeUndefined()
      } finally {
        wrapper.unmount()
      }
    })

    it('shows composition grid when grid preference is on', async () => {
      mock_grid.value = true
      const wrapper = shallowMount(as_svg, {
        props: { itemid, sync_poster: vector_fixture() }
      })
      await flushPromises()
      expect(wrapper.find('g[data-grid-overlay]').exists()).toBe(true)
      mock_grid.value = false
    })
  })
})
