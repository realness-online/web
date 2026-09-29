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

const json_response = (body, ok = true) => ({
  ok,
  json: async () => body
})

const editions = (sold = []) => ({
  amounts: [500, 10000, 50000],
  sold,
  currency: 'usd'
})
const mount_prints = () => shallowMount(Prints)
const poster_buttons = wrapper =>
  wrapper.findAll("ol[role='feed'] > li > button")
const price_buttons = wrapper => wrapper.findAll('dialog form ol button')

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
  global.fetch = vi.fn(() => Promise.resolve(json_response(editions())))
  HTMLDialogElement.prototype.showModal ??= vi.fn()
  HTMLDialogElement.prototype.close ??= vi.fn()
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
    const shown = wrapper.findAll('ol[role="feed"] as-figure-stub')
    expect(shown).toHaveLength(21)
    expect(shown[0].attributes('itemid')).toBe(ids[0])
    expect(shown.at(-1).attributes('itemid')).toBe(ids[20])
    expect(mock_load).toHaveBeenCalledTimes(21)
  })

  it('opens a poster after its $5 sale, with a dot beside only $5', async () => {
    global.fetch = vi.fn(() => Promise.resolve(json_response(editions([500]))))
    const wrapper = mount_prints()
    await flushPromises()
    expect(poster_buttons(wrapper)[0].attributes('disabled')).toBeUndefined()
    await poster_buttons(wrapper)[0].trigger('click')
    await flushPromises()
    expect(wrapper.vm.showing).toBe(first_id)
    expect(wrapper.find('dialog as-figure-stub').exists()).toBe(true)
    expect(price_buttons(wrapper).map(button => button.text())).toEqual([
      '$5●',
      '$100',
      '$500'
    ])
    expect(price_buttons(wrapper)[0].attributes('disabled')).toBeDefined()
    expect(price_buttons(wrapper)[1].attributes('disabled')).toBeUndefined()
  })

  it('keeps $500 available with a dot after a $500 sale', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(json_response(editions([500, 10000, 50000])))
    )
    const wrapper = mount_prints()
    await flushPromises()
    await poster_buttons(wrapper)[0].trigger('click')
    await flushPromises()
    expect(price_buttons(wrapper)[2].text()).toBe('$500●')
    expect(price_buttons(wrapper)[2].attributes('disabled')).toBeUndefined()
  })

  it('does not guess prices when the checkout endpoint fails', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    const wrapper = mount_prints()
    await flushPromises()
    await poster_buttons(wrapper)[0].trigger('click')
    await flushPromises()
    expect(price_buttons(wrapper)).toHaveLength(0)
    expect(wrapper.find('dialog [role="status"]').text()).toBe(
      'Checkout unavailable'
    )
    expect(wrapper.find('dialog a').attributes('href')).toBe(
      `sms:${admin_id.slice(1)}`
    )
  })

  it('asks for the selected poster editions', async () => {
    const wrapper = mount_prints()
    await flushPromises()
    await poster_buttons(wrapper)[1].trigger('click')
    await flushPromises()
    expect(global.fetch).toHaveBeenCalledWith(
      `/prints-checkout?poster_id=${encodeURIComponent(second_id)}`
    )
  })

  it('posts the selected price and poster id to checkout', async () => {
    const wrapper = mount_prints()
    await flushPromises()
    await poster_buttons(wrapper)[1].trigger('click')
    await flushPromises()
    await wrapper.vm.buy(second_id, 10000)
    const [url, options] = global.fetch.mock.calls.at(-1)
    expect(url).toBe('/prints-checkout')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      poster_id: second_id,
      amount: 10000
    })
  })

  it('surfaces a checkout error instead of failing silently', async () => {
    global.fetch = vi.fn((url, options) =>
      options?.method === 'POST'
        ? Promise.resolve(
            json_response({ error: 'Print edition already sold' }, false)
          )
        : Promise.resolve(json_response(editions()))
    )
    const wrapper = mount_prints()
    await flushPromises()
    await poster_buttons(wrapper)[1].trigger('click')
    await flushPromises()
    await wrapper.vm.buy(second_id, 500)
    expect(wrapper.find('[role="alert"]').text()).toBe(
      'Print edition already sold'
    )
    expect(wrapper.find('dialog a').attributes('href')).toBe(
      `sms:${admin_id.slice(1)}`
    )
  })
})
