import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import as_animation from '@/components/posters/as-animation.vue'
import { animate, morph } from '@/utils/preference'

vi.mock('@/use/poster-morph', async import_original => {
  const actual = await import_original()
  return {
    ...actual,
    morph_paths: vi.fn(async () => ['L0', 'L1', 'L2', 'L3'])
  }
})

const poster_id = '/+14151234356/posters/1770000000000'

const as_svg = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.pauseAnimations = vi.fn()
  svg.unpauseAnimations = vi.fn()
  svg.getCurrentTime = () => 5
  return svg
}

/** Leaf SMIL animations, stubbed so wind-downs can schedule their ends */
const as_leaves = wrapper =>
  wrapper
    .findAll('animate')
    .filter(animation => animation.attributes('dur'))
    .map(animation => (animation.element.endElementAt = vi.fn()))

describe('@/component/posters/as-animation.vue', () => {
  afterEach(() => {
    animate.value = false
    morph.value = false
    vi.useRealTimers()
  })

  it('starts every SMIL animation immediately (none left as begin="indefinite")', () => {
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg: as_svg(),
        paused: false
      }
    })

    // The template also nests plain `<animate>` elements as structural
    // groupers (e.g. `itemprop="timeline"`); only the leaf animations that
    // declare `attributeName` are real SMIL animations with a `begin`.
    const animations = wrapper
      .findAll('animate')
      .filter(animation => animation.attributes('attributename'))
    expect(animations.length).toBeGreaterThan(0)
    animations.forEach(animation => {
      expect(animation.attributes('begin')).toBe('0s')
    })
  })

  it('rests each morph layer on its own shape at the end of a cycle', async () => {
    morph.value = true
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg: as_svg(),
        paused: false,
        focused: true,
        vector: {}
      }
    })
    await flushPromises()

    const morphs = wrapper
      .findAll('animate')
      .filter(animation => animation.attributes('attributename') === 'd')
    expect(morphs.length).toBe(4)

    const light = morphs[0]
    expect(light.attributes('values')).toBe('L0;L1;L0;L0')
    expect(light.attributes('keytimes')).toBe('0;0.3333;0.6667;1')
    expect(light.attributes('keysplines').split(';').length).toBe(3)

    // Bold breathes over 90 base-seconds, so its 6-second rest is a short
    // slice at the end rather than a third of the cycle
    const bold = morphs[3]
    expect(bold.attributes('values')).toBe('L3;L2;L3;L3')
    expect(bold.attributes('keytimes')).toBe('0;0.4667;0.9333;1')
  })

  it('lets every animation land on its base value before pausing', async () => {
    animate.value = true
    const svg = as_svg()
    const wrapper = mount(as_animation, {
      props: { id: poster_id, svg, paused: false }
    })
    await nextTick()
    const ends = as_leaves(wrapper)
    expect(ends.length).toBeGreaterThan(0)
    svg.pauseAnimations.mockClear()
    vi.useFakeTimers()

    animate.value = false
    await nextTick()
    expect(svg.pauseAnimations).not.toHaveBeenCalled()
    ends.forEach(end => expect(end).toHaveBeenCalled())

    vi.runAllTimers()
    await nextTick()
    expect(svg.pauseAnimations).toHaveBeenCalled()
  })

  it('keeps morph layers until they finish their cycle after morph turns off', async () => {
    animate.value = true
    morph.value = true
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg: as_svg(),
        paused: false,
        focused: true,
        vector: {}
      }
    })
    await flushPromises()
    as_leaves(wrapper)
    vi.useFakeTimers()

    morph.value = false
    await nextTick()
    const still_morphing = wrapper
      .findAll('animate')
      .filter(animation => animation.attributes('attributename') === 'd')
    expect(still_morphing.length).toBe(4)

    vi.runAllTimers()
    await nextTick()
    const after = wrapper
      .findAll('animate')
      .filter(animation => animation.attributes('attributename') === 'd')
    expect(after.length).toBe(0)
  })
})
