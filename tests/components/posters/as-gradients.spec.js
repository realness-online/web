import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount } from '@vue/test-utils'
import AsGradients from '@/components/posters/as-gradients.vue'
import { color_to_hsla } from '@/utils/colors'

const { mock_gradients } = vi.hoisted(() => {
  const create_ref = value => ({ value, __v_isRef: true })
  return { mock_gradients: create_ref(null) }
})

vi.mock('@/use/poster', () => ({
  is_vector: () => true
}))

vi.mock('@/use/vectorize', () => ({
  use: () => ({ new_gradients: mock_gradients })
}))

vi.mock('@/utils/itemid', () => ({
  as_query_id: id => id.replace(/\//g, '-').slice(1)
}))

const stop_el = (color, offset) => ({
  getAttribute: name => {
    if (name === 'stop-color') return color
    if (name === 'offset') return offset
    return null
  }
})

const vector = {
  id: '/+14151234356/posters/1000',
  horizontal: [
    stop_el('hsl(10 50% 40%)', '0%'),
    stop_el('hsl(20 50% 40%)', '100%')
  ],
  vertical: [stop_el('hsl(30 50% 40%)', '50%')],
  radial: [stop_el('hsl(40 50% 40%)', '0%')]
}

const mount = (props = {}) =>
  shallowMount(AsGradients, {
    props: { vector, ...props },
    global: { stubs: { 'as-stops': true } }
  })

describe('@/components/posters/as-gradients', () => {
  beforeEach(() => {
    mock_gradients.value = null
  })

  it('renders lightbar and query-id gradient shells', () => {
    const wrapper = mount()
    expect(wrapper.find('radialGradient#lightbar').exists()).toBe(true)
    expect(wrapper.html()).toContain('id="+14151234356-posters-1000-radial"')
    expect(wrapper.html()).toContain('id="+14151234356-posters-1000-vertical"')
    expect(wrapper.html()).toContain(
      'id="+14151234356-posters-1000-horizontal"'
    )
  })

  it('converts vector stop attributes into gradient stops', () => {
    const wrapper = mount()
    expect(wrapper.findAll('stop[itemprop="horizontal"]')).toHaveLength(2)
    expect(wrapper.findAll('stop[itemprop="vertical"]')).toHaveLength(1)
    expect(wrapper.findAll('stop[itemprop="radial"]')).toHaveLength(1)
    expect(
      wrapper.find('stop[itemprop="horizontal"]').attributes('stop-color')
    ).toMatch(/^oklch\(/)
  })

  it('prefers live vectorize gradients when present', async () => {
    const color = color_to_hsla({ h: 120, s: 40, l: 50, a: 1 })
    mock_gradients.value = {
      horizontal: [{ offset: '25', color }],
      vertical: [{ offset: '75', color }],
      radial: [{ offset: '10', color }]
    }
    const wrapper = mount()
    expect(
      wrapper.find('stop[itemprop="horizontal"]').attributes('offset')
    ).toBe('25%')
    expect(wrapper.find('stop[itemprop="vertical"]').attributes('offset')).toBe(
      '75%'
    )
  })

  it('passes converted stops into as-stops layers', () => {
    const wrapper = mount()
    const stops = wrapper.findAllComponents({ name: 'as-stops' })
    expect(stops.length).toBeGreaterThan(5)
    expect(stops[0].props('stops')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offset: expect.any(String) })
      ])
    )
  })
})
