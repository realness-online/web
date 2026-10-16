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

/** Controllable rAF, so a test decides when a frame runs. */
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

/**
 * Vue renders the template's animations as plain HTML here, which lowercases
 * their attribute names; a settle leg is built in the SVG namespace and keeps
 * its camelCase.
 */
const attribute_name_of = animation =>
  animation.attributes('attributeName') ?? animation.attributes('attributename')

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

      expect(light.getAttribute('d')).toBe('L0')
    } finally {
      light.remove()
    }
  })

  it('never primes the shadow to morph geometry while animate is off', async () => {
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

      expect(
        wrapper
          .findAll('animate')
          .filter(animation => animation.attributes('attributename') === 'd')
      ).toHaveLength(4)
      expect(light.getAttribute('d')).toBe('L0')

      vi.runAllTimers()
      await nextTick()

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

      expect(bold.style.transition).toContain('d')
      expect(bold.style.transition).toContain('5s')
      expect(bold.getAttribute('d')).toBe('L3')

      const morphs = wrapper
        .findAll('animate')
        .filter(animation => animation.attributes('attributename') === 'd')
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

  it('walks an animation whose boundary is past the cap home, then pauses on time', async () => {
    animate.value = true
    const svg = as_svg()
    const wrapper = mount(as_animation, {
      props: { id: poster_id, svg, paused: false }
    })
    await nextTick()
    as_leaves(wrapper)
    svg.pauseAnimations.mockClear()
    use_fake_timers()

    animate.value = false
    await nextTick()

    const legs = wrapper
      .findAll('animate')
      .filter(animation => animation.attributes('itemprop') === 'settle')
    expect(legs.length).toBeGreaterThan(0)
    legs.forEach(leg => {
      const [from, home] = leg.attributes('values').split(';')
      const source = wrapper
        .findAll('animate')
        .find(
          animation =>
            animation.attributes('itemprop') !== 'settle' &&
            animation.attributes('href') === leg.attributes('href') &&
            attribute_name_of(animation) === attribute_name_of(leg)
        )
      const resting = source.attributes('values').split(';')[0]
      expect(home).toBe(resting)
      expect(from).not.toBe('')
      expect(leg.attributes('dur')).toBe('5s')
    })

    vi.advanceTimersByTime(4999)
    await nextTick()
    expect(svg.pauseAnimations).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(svg.pauseAnimations).toHaveBeenCalled()
    expect(
      wrapper
        .findAll('animate')
        .filter(animation => animation.attributes('itemprop') === 'settle')
    ).toHaveLength(0)
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

  describe('keyboard scrubbing', () => {
    const mount_animation = () => {
      const svg = as_svg()
      svg.setCurrentTime = vi.fn()
      return {
        svg,
        wrapper: mount(as_animation, {
          props: {
            id: poster_id,
            svg,
            paused: false,
            in_view: true,
            vector: {}
          }
        })
      }
    }

    it('scrubs the timeline on an arrow key', async () => {
      const { wrapper, svg } = mount_animation()
      use_fake_timers()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      vi.advanceTimersByTime(200)
      await nextTick()

      expect(svg.setCurrentTime).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('leaves other keys to the page', async () => {
      const { wrapper, svg } = mount_animation()
      use_fake_timers()

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        cancelable: true
      })
      window.dispatchEvent(event)
      vi.advanceTimersByTime(200)
      await nextTick()

      expect(svg.setCurrentTime).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
      wrapper.unmount()
    })

    it('leaves the arrows alone when a modifier is held', async () => {
      const { wrapper, svg } = mount_animation()
      use_fake_timers()

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        ctrlKey: true,
        cancelable: true
      })
      window.dispatchEvent(event)
      vi.advanceTimersByTime(200)
      await nextTick()

      expect(svg.setCurrentTime).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
      wrapper.unmount()
    })

    it('stops listening once the animation unmounts', async () => {
      const { wrapper, svg } = mount_animation()
      use_fake_timers()
      wrapper.unmount()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      vi.advanceTimersByTime(200)

      expect(svg.setCurrentTime).not.toHaveBeenCalled()
    })
  })

  describe('visibility', () => {
    it('re-pauses SMIL when the page is shown again with animation off', async () => {
      animate.value = false
      const svg = as_svg()
      const wrapper = mount(as_animation, {
        props: { id: poster_id, svg, paused: false, in_view: true, vector: {} }
      })
      await flushPromises()
      svg.pauseAnimations.mockClear()

      window.dispatchEvent(new Event('pageshow'))
      await nextTick()

      expect(svg.pauseAnimations).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('leaves SMIL running on a pageshow while animation is on', async () => {
      animate.value = true
      const svg = as_svg()
      const wrapper = mount(as_animation, {
        props: { id: poster_id, svg, paused: false, in_view: true, vector: {} }
      })
      await flushPromises()
      svg.pauseAnimations.mockClear()

      window.dispatchEvent(new Event('pageshow'))
      await nextTick()

      expect(svg.pauseAnimations).not.toHaveBeenCalled()
      wrapper.unmount()
    })
  })
})

describe('@/component/posters/as-animation keyboard and visibility', () => {
  const mount_animation = (props = {}) => {
    const svg = as_svg()
    svg.setCurrentTime = vi.fn()
    return {
      svg,
      wrapper: mount(as_animation, {
        props: {
          id: poster_id,
          svg,
          paused: false,
          in_view: true,
          vector: {},
          ...props
        }
      })
    }
  }

  afterEach(() => {
    animate.value = false
    morph.value = false
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('moves the timeline forward on ArrowRight', async () => {
    const { wrapper, svg } = mount_animation()
    use_fake_timers()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    vi.advanceTimersByTime(300)

    expect(svg.setCurrentTime).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('moves the timeline back on ArrowLeft without going below zero', async () => {
    const { wrapper, svg } = mount_animation()
    use_fake_timers()
    svg.getCurrentTime = () => 0

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    vi.advanceTimersByTime(300)

    expect(svg.setCurrentTime).toHaveBeenCalledWith(0)
    wrapper.unmount()
  })

  it('takes a bigger step with shift held', async () => {
    const { wrapper, svg } = mount_animation()
    use_fake_timers()

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true })
    )
    vi.advanceTimersByTime(300)

    expect(svg.setCurrentTime).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('leaves the arrows alone while a text field has focus', async () => {
    const svg = as_svg()
    svg.setCurrentTime = vi.fn()
    const wrapper = mount(as_animation, {
      props: { id: poster_id, svg, paused: false, in_view: true, vector: {} },
      global: {
        provide: { 'key-commands': { check_input_focus: () => true } }
      }
    })
    use_fake_timers()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    vi.advanceTimersByTime(300)

    expect(svg.setCurrentTime).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('speeds up as the arrow is held or repeated', async () => {
    const svg = as_svg()
    const times = []
    svg.setCurrentTime = time => times.push(time)
    const wrapper = mount(as_animation, {
      props: { id: poster_id, svg, paused: false, in_view: true, vector: {} }
    })
    use_fake_timers()

    for (let press = 0; press < 3; press++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      vi.advanceTimersByTime(80)
    }

    expect(times.length).toBeGreaterThan(1)
    expect(times.at(-1)).toBeGreaterThan(times[0])
    wrapper.unmount()
  })

  it('throttles a burst of arrow presses', async () => {
    const { wrapper, svg } = mount_animation()
    use_fake_timers()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    vi.advanceTimersByTime(300)

    expect(svg.setCurrentTime.mock.calls.length).toBeLessThan(3)
    wrapper.unmount()
  })
})
