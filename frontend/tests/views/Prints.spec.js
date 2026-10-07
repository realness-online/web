import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import Prints from '@/views/Prints.vue'

import.meta.env.VITE_ADMIN_ID ??= '/+14151234356'
const admin_id = import.meta.env.VITE_ADMIN_ID
const first_id = `${admin_id}/posters/1700000000000`
const second_id = `${admin_id}/posters/1700000000001`

const { mock_for_person, mock_load, poster_list } = vi.hoisted(() => ({
  mock_for_person: vi.fn(),
  mock_load: vi.fn(),
  poster_list: []
}))

poster_list.push(
  { id: first_id, type: 'posters' },
  { id: second_id, type: 'posters' }
)

vi.mock('@/components/posters/as-figure', () => ({
  default: { name: 'AsFigure', template: '<figure />' }
}))

vi.mock('@/use/poster', () => ({
  use_posters: () => ({
    posters: { value: poster_list },
    for_person: mock_for_person
  })
}))

vi.mock('@/utils/itemid', async importOriginal => ({
  ...(await importOriginal()),
  load: mock_load
}))

const mount_prints = () => shallowMount(Prints)
// shallowMount stubs the link, so the poster inside it never renders.
const print_links = wrapper =>
  wrapper.findAll("ol[role='feed'] > li > router-link-stub")

beforeEach(() => {
  vi.clearAllMocks()
  poster_list.splice(
    0,
    poster_list.length,
    { id: first_id, type: 'posters' },
    { id: second_id, type: 'posters' }
  )
  mock_for_person.mockResolvedValue(undefined)
  mock_load.mockResolvedValue({ viewbox: '0 0 512 512' })
})

describe('@/views/Prints', () => {
  it('renders the title and intro', async () => {
    const wrapper = mount_prints()
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('Hand-finished prints')
    expect(wrapper.text()).toContain('finished by hand')
  })

  it('shows only the 21 newest admin posters', async () => {
    const ids = Array.from(
      { length: 25 },
      (_, index) => `${admin_id}/posters/${1700000000025 - index}`
    )
    poster_list.splice(
      0,
      poster_list.length,
      { id: '/+15551234567/posters/1800000000000', type: 'posters' },
      ...ids.map(id => ({ id, type: 'posters' }))
    )
    const wrapper = mount_prints()
    await flushPromises()
    expect(print_links(wrapper)).toHaveLength(21)
    const tail = id => id.split('/').at(-1)
    expect(print_links(wrapper)[0].attributes('to')).toBe(
      `/prints/${tail(ids[0])}`
    )
    expect(print_links(wrapper).at(-1).attributes('to')).toBe(
      `/prints/${tail(ids[20])}`
    )
    expect(mock_load).toHaveBeenCalledTimes(21)
  })

  it('links every print to its own page', async () => {
    const wrapper = mount_prints()
    await flushPromises()
    expect(print_links(wrapper).map(link => link.attributes('to'))).toEqual([
      `/prints/${first_id.split('/').at(-1)}`,
      `/prints/${second_id.split('/').at(-1)}`
    ])
  })

  it('carries no shop controls, only the way in', async () => {
    const wrapper = mount_prints()
    await flushPromises()
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
