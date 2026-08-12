import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import as_animation from '@/components/posters/as-animation.vue'
import { animate, morph } from '@/utils/preference'
import { as_layer_id, as_query_id } from '@/utils/itemid'

vi.mock('@/use/poster-morph', async import_original => {
  const actual = await import_original()
  return {
    ...actual,
    morph_paths: vi.fn(async () => ['L0', 'L1', 'L2', 'L3'])
  }
})

/** Captures the poster's gyro state so a test can tilt it */
let gyro_binding_state = null
vi.mock('@/3d/engine/bind-device-orientation', () => ({
  bind_device_orientation: vi.fn(({ state }) => {
    gyro_binding_state = state
    return vi.fn()
  })
}))

/**
 * Controllable rAF. Fake timers would spin the gyro nudge loop forever on
 * `runAllTimers`, so the loop only runs when a test flushes a frame.
 */
let raf_callbacks = new Set()
let raf_id = 0

const use_fake_timers = () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(callback => {
      raf_callbacks.add(callback)
      return ++raf_id
    })
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

const flush_raf = () => {
  const pending = [...raf_callbacks]
  raf_callbacks.clear()
  pending.forEach(callback => callback())
}

const poster_id = '/+14151234356/posters/1770000000000'

const as_svg = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.pauseAnimations = vi.fn()
  svg.unpauseAnimations = vi.fn()
  svg.getCurrentTime = () => 5
  svg.setCurrentTime = vi.fn()
  return svg
}

/** Leaf SMIL animations, stubbed so wind-downs can schedule their ends */
const as_leaves = wrapper =>
  wrapper
    .findAll('animate')
    .filter(animation => animation.attributes('dur'))
    .map(animation => (animation.element.endElementAt = vi.fn()))

/** The real shadow path element morph's SMIL targets by id, for a given layer */
const as_shadow_path = name => {
  const path = document.createElement('path')
  path.id = `${as_query_id(as_layer_id(poster_id, 'shadows'))}-${name}`
  document.body.append(path)
  return path
}

describe('@/component/posters/as-animation.vue', () => {
  beforeEach(() => {
    raf_callbacks.clear()
    raf_id = 0
  })

  afterEach(() => {
    animate.value = false
    morph.value = false
    vi.unstubAllGlobals()
    vi.useRealTimers()
    raf_callbacks.clear()
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

  it('starts morph moving as soon as its geometry is ready, no delay', async () => {
    animate.value = true
    morph.value = true
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg: as_svg(),
        paused: false,
        in_view: true,
        vector: {}
      }
    })
    await flushPromises()
    await nextTick()

    expect(
      wrapper
        .findAll('animate')
        .filter(animation => animation.attributes('attributename') === 'd')
    ).toHaveLength(4)
  })

  it('primes the shadow to morph own shape before it ever moves, so nothing pops at the start', async () => {
    animate.value = true
    morph.value = true
    use_fake_timers()
    const light = as_shadow_path('light')
    try {
      mount(as_animation, {
        props: {
          id: poster_id,
          svg: as_svg(),
          paused: false,
          in_view: true,
          vector: {}
        }
      })
      await flushPromises()
      await nextTick()

      // Morph hasn't started moving yet, but the shadow already shows what
      // its first frame will be rather than the un-normalized original
      expect(light.getAttribute('d')).toBe('L0')
    } finally {
      light.remove()
    }
  })

  it('never primes the shadow to morph geometry while animate is off', async () => {
    // animate stays off - morph riding on a paused timeline still means
    // nothing is moving, so there is no reason to pay for the heavier shape
    morph.value = true
    use_fake_timers()
    const light = as_shadow_path('light')
    try {
      mount(as_animation, {
        props: {
          id: poster_id,
          svg: as_svg(),
          paused: false,
          in_view: true,
          vector: { light: 'RAW_LIGHT' }
        }
      })
      await flushPromises()
      await nextTick()
      vi.runAllTimers()
      await nextTick()

      expect(light.getAttribute('d')).toBe('RAW_LIGHT')
    } finally {
      light.remove()
    }
  })

  it('keeps the shadow on morph shape through a wind-down, then falls back once morph is off', async () => {
    animate.value = true
    morph.value = true
    use_fake_timers()
    const light = as_shadow_path('light')
    try {
      const wrapper = mount(as_animation, {
        props: {
          id: poster_id,
          svg: as_svg(),
          paused: false,
          in_view: true,
          vector: { light: 'RAW_LIGHT' }
        }
      })
      await flushPromises()
      await nextTick()
      vi.runAllTimers()
      await nextTick()
      as_leaves(wrapper)

      morph.value = false
      await nextTick()

      // Still winding down - the animate elements are still landing on this
      // same value, so the base must not jump out from under them yet
      expect(
        wrapper
          .findAll('animate')
          .filter(animation => animation.attributes('attributename') === 'd')
      ).toHaveLength(4)
      expect(light.getAttribute('d')).toBe('L0')

      vi.runAllTimers()
      await nextTick()

      // Morph is done with it - no reason to keep paying for the heavier
      // normalized geometry once the reader can no longer see it move
      expect(
        wrapper
          .findAll('animate')
          .filter(animation => animation.attributes('attributename') === 'd')
      ).toHaveLength(0)
      expect(light.getAttribute('d')).toBe('RAW_LIGHT')
    } finally {
      light.remove()
    }
  })

  it('caps a wind-down at a few seconds instead of waiting out a slow layer full cycle', async () => {
    animate.value = true
    morph.value = true
    use_fake_timers()
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg: as_svg(),
        paused: false,
        in_view: true,
        vector: {}
      }
    })
    await flushPromises()
    await nextTick()
    vi.runAllTimers()
    await nextTick()
    as_leaves(wrapper)

    morph.value = false
    await nextTick()

    // The slowest layer's own cycle boundary is well past the cap here -
    // still present just before it, gone right at it
    vi.advanceTimersByTime(4999)
    await nextTick()
    expect(
      wrapper
        .findAll('animate')
        .filter(animation => animation.attributes('attributename') === 'd')
    ).toHaveLength(4)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(
      wrapper
        .findAll('animate')
        .filter(animation => animation.attributes('attributename') === 'd')
    ).toHaveLength(0)
  })

  it('glides a capped layer home with a CSS transition instead of freezing mid-breath', async () => {
    animate.value = true
    morph.value = true
    use_fake_timers()
    const bold = as_shadow_path('bold')
    try {
      const wrapper = mount(as_animation, {
        props: {
          id: poster_id,
          svg: as_svg(),
          paused: false,
          in_view: true,
          vector: {}
        }
      })
      await flushPromises()
      await nextTick()
      vi.runAllTimers()
      await nextTick()
      as_leaves(wrapper)

      morph.value = false
      await nextTick()

      // Bold's own boundary (40s) is well past the cap - ended right away
      // rather than left running, then glided home with a real transition
      expect(bold.style.transition).toContain('d')
      expect(bold.style.transition).toContain('5s')
      expect(bold.getAttribute('d')).toBe('L3')

      const morphs = wrapper
        .findAll('animate')
        .filter(animation => animation.attributes('attributename') === 'd')
      // Light's own boundary (4s) is inside the cap - it keeps breathing
      // toward it on its existing cycle, untouched by the settle
      const light = morphs.find(animation =>
        animation.attributes('href').endsWith('-light')
      )
      expect(light.attributes('values')).toBe('L0;L1;L2;L3;L2;L1;L0;L0')
    } finally {
      bold.remove()
    }
  })

  it('rests each morph layer on its own shape at the end of a cycle', async () => {
    animate.value = true
    morph.value = true
    use_fake_timers()
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg: as_svg(),
        paused: false,
        in_view: true,
        vector: {}
      }
    })
    await flushPromises()
    await nextTick()
    vi.runAllTimers()
    await nextTick()

    const morphs = wrapper
      .findAll('animate')
      .filter(animation => animation.attributes('attributename') === 'd')
    expect(morphs.length).toBe(4)

    const light = morphs[0]
    expect(light.attributes('values')).toBe('L0;L1;L2;L3;L2;L1;L0;L0')
    expect(light.attributes('keytimes')).toBe(
      '0;0.1481;0.2963;0.4444;0.5926;0.7407;0.8889;1'
    )
    expect(light.attributes('keysplines').split(';').length).toBe(7)

    // Bold sweeps down from its own density, so its 6-second rest is a short
    // slice at the end rather than a third of the cycle
    const bold = morphs[3]
    expect(bold.attributes('values')).toBe('L3;L2;L1;L0;L1;L2;L3;L3')
    expect(bold.attributes('keytimes')).toBe(
      '0;0.163;0.3259;0.4889;0.6519;0.8148;0.9778;1'
    )
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
    use_fake_timers()

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
    use_fake_timers()
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg: as_svg(),
        paused: false,
        in_view: true,
        vector: {}
      }
    })
    await flushPromises()
    await nextTick()
    vi.runAllTimers()
    await nextTick()
    as_leaves(wrapper)

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

  it('nudges the timeline forward while tiled and morph is running', async () => {
    animate.value = true
    morph.value = true
    use_fake_timers()
    const svg = as_svg()
    const wrapper = mount(as_animation, {
      props: {
        id: poster_id,
        svg,
        paused: false,
        in_view: true,
        vector: {}
      }
    })
    await flushPromises()
    await nextTick()
    vi.runAllTimers()
    await nextTick()

    // Tilt the poster the binding would have fed gyro_state
    gyro_binding_state.gyro_x = 1
    flush_raf()

    // One eased nudge step scrubs the svg ahead past its natural clock
    expect(svg.setCurrentTime).toHaveBeenCalled()
    const delta = svg.setCurrentTime.mock.calls.at(-1)[0] - 5
    expect(delta).toBeGreaterThan(0)
  })
})
