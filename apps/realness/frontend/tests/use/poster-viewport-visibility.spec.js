import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { use_poster_viewport_visibility } from '@/use/poster-viewport-visibility'

const { mock_measure } = vi.hoisted(() => ({
  mock_measure: vi.fn(() => ({ intersecting: true, in_view: true }))
}))

vi.mock('@/utils/intersection', () => ({
  INTERSECTION_THRESHOLDS: [0, 1],
  measure_visibility: (...args) => mock_measure(...args)
}))

const mounted = []

/** Runs the composable inside a component so lifecycle hooks are live. */
const with_setup = (element_ref, options) => {
  let result
  const wrapper = mount(
    defineComponent({
      setup() {
        result = use_poster_viewport_visibility(element_ref, options)
        return () => h('div')
      }
    })
  )
  mounted.push(wrapper)
  return { result, wrapper }
}

describe('@/use/poster-viewport-visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_measure.mockReturnValue({ intersecting: true, in_view: true })
    global.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
  })

  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount())
    vi.unstubAllGlobals()
  })

  it('starts hidden before anything is measured', () => {
    const { result } = with_setup(ref(null))

    expect(result.intersecting.value).toBe(false)
    expect(result.in_view.value).toBe(false)
  })

  it('measures an element when synced', () => {
    const el = document.createElement('div')
    mock_measure.mockReturnValue({ intersecting: true, in_view: false })
    const { result } = with_setup(ref(el))

    result.sync()

    expect(mock_measure).toHaveBeenCalledWith(el)
    expect(result.intersecting.value).toBe(true)
    expect(result.in_view.value).toBe(false)
  })

  it('clears both flags when the element goes away', () => {
    const el = document.createElement('div')
    const element_ref = ref(el)
    const { result } = with_setup(element_ref)
    result.sync()
    expect(result.intersecting.value).toBe(true)

    element_ref.value = null
    result.sync()

    expect(result.intersecting.value).toBe(false)
    expect(result.in_view.value).toBe(false)
  })

  it('forces intersecting when the caller asks for it', async () => {
    const force = ref(false)
    const { result } = with_setup(ref(null), { force_intersecting: force })

    expect(result.intersecting.value).toBe(false)
    force.value = true
    await nextTick()

    expect(result.intersecting.value).toBe(true)
  })

  it('never un-forces once intersecting is forced', async () => {
    const force = ref(true)
    const { result } = with_setup(ref(null), { force_intersecting: force })
    expect(result.intersecting.value).toBe(true)

    force.value = false
    await nextTick()

    expect(result.intersecting.value).toBe(true)
  })

  it('schedules a re-measure on scroll', async () => {
    const el = document.createElement('div')
    mock_measure.mockReturnValue({ intersecting: true, in_view: true })
    const frames = []
    vi.stubGlobal('requestAnimationFrame', callback => {
      frames.push(callback)
      return frames.length
    })
    const { result } = with_setup(ref(el))
    result.sync()
    frames.length = 0
    mock_measure.mockClear()

    window.dispatchEvent(new Event('scroll'))
    frames.forEach(frame => frame())

    expect(mock_measure).toHaveBeenCalledWith(el)
  })

  it('does not schedule a measure while the poster is off screen', () => {
    const el = document.createElement('div')
    const frames = []
    vi.stubGlobal('requestAnimationFrame', callback => {
      frames.push(callback)
      return frames.length
    })
    const { wrapper } = with_setup(ref(el))
    wrapper.unmount()
    frames.length = 0

    window.dispatchEvent(new Event('scroll'))

    expect(frames).toHaveLength(0)
  })

  it('removes its listeners when the component unmounts', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { wrapper } = with_setup(ref(document.createElement('div')))

    wrapper.unmount()

    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), {
      capture: true
    })
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    remove.mockRestore()
  })
})
