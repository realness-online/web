import { describe, it, expect } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import AsStops from '@/components/posters/as-stops.vue'

const stops = [
  { offset: 0, color: { h: 10, s: 20, l: 30 } },
  { offset: 100, color: { h: 200, s: 80, l: 40 } }
]

describe('@/components/posters/as-stops', () => {
  it('renders a stop for each color stop', () => {
    const wrapper = shallowMount(AsStops, {
      props: { luminosity: 50, stops }
    })
    const stop_els = wrapper.findAll('stop')
    expect(stop_els).toHaveLength(2)
    expect(stop_els[0].attributes('offset')).toBe('0%')
    expect(stop_els[1].attributes('offset')).toBe('100%')
    expect(stop_els[0].attributes('stop-color')).toMatch(/^oklch\(/)
  })

  it('raises saturation to the floor when below it', () => {
    const wrapper = shallowMount(AsStops, {
      props: { luminosity: 50, stops, saturation_floor: 40 }
    })
    const stop_els = wrapper.findAll('stop')
    // second stop already above floor; first stop was s:20 → floored
    expect(stop_els).toHaveLength(2)
    expect(stop_els[0].attributes('stop-color')).toBeTruthy()
    expect(stop_els[1].attributes('stop-color')).toBeTruthy()
  })
})
