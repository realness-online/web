import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import Prints from '@/views/Prints.vue'

import.meta.env.VITE_ADMIN_ID ??= '/+14151234356'
const admin_id = import.meta.env.VITE_ADMIN_ID
const sold_id = `${admin_id}/posters/1700000000000`
const open_id = `${admin_id}/posters/1700000000001`

const { mock_for_person, mock_load, poster_list } = vi.hoisted(() => ({
  mock_for_person: vi.fn(),
  mock_load: vi.fn(),
  poster_list: []
}))

poster_list.push(
  { id: sold_id, type: 'posters' },
  { id: open_id, type: 'posters' }
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

vi.mock('@/utils/itemid', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, load: mock_load }
})

/** @returns {{ ok: boolean, json: () => Promise<object> }} */
const json_response = (body, ok = true) => ({
  ok,
  json: async () => body
})

const mount_prints = () => shallowMount(Prints)

describe('@/views/Prints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock_for_person.mockResolvedValue(undefined)
    mock_load.mockResolvedValue({ viewbox: '0 0 512 512' })
    global.fetch = vi.fn(() =>
      Promise.resolve(json_response({ amount: 500, currency: 'usd' }))
    )
    HTMLDialogElement.prototype.showModal ??= vi.fn()
    HTMLDialogElement.prototype.close ??= vi.fn()
  })

  it('renders the title and intro', async () => {
    const wrapper = mount_prints()
    await flushPromises()

    expect(wrapper.find('h1').text()).toBe('Hand-finished prints')
    expect(wrapper.text()).toContain('finished by hand')
  })

  it('marks a sold print and leaves the rest open', async () => {
    mock_load.mockImplementation(id =>
      Promise.resolve(
        id === sold_id
          ? { viewbox: '0 0 512 512', sale: { date: '2026-01-01' } }
          : { viewbox: '0 0 512 512' }
      )
    )
    const wrapper = mount_prints()
    await flushPromises()

    const buttons = wrapper.findAll("ol[role='feed'] > li > button")
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('disabled')).toBeDefined()
    expect(buttons[1].attributes('disabled')).toBeUndefined()
  })

  it('turns a print sold when sync reports the author changed', async () => {
    const refresh = ref(null)
    const wrapper = shallowMount(Prints, {
      global: { provide: { feed_needs_refresh: refresh } }
    })
    await flushPromises()

    const first_button = () =>
      wrapper.findAll("ol[role='feed'] > li > button")[0]
    expect(first_button().attributes('disabled')).toBeUndefined()

    mock_load.mockImplementation(id =>
      Promise.resolve(
        id === sold_id
          ? { viewbox: '0 0 512 512', sale: { date: '2026-01-01' } }
          : { viewbox: '0 0 512 512' }
      )
    )
    refresh.value = { at: Date.now() }
    await flushPromises()

    expect(first_button().attributes('disabled')).toBeDefined()
  })

  it('shows the price the checkout function quotes', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(json_response({ amount: 10000, currency: 'usd' }))
    )
    const wrapper = mount_prints()
    await flushPromises()

    expect(wrapper.find('dialog button[type="submit"]').text()).toBe('$100')
  })

  it('says Buy rather than guess a price when the fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    const wrapper = mount_prints()
    await flushPromises()

    expect(wrapper.find('dialog button[type="submit"]').text()).toBe('Buy')
  })

  it('opens the chosen print in the dialog', async () => {
    const wrapper = mount_prints()
    await flushPromises()

    await wrapper.findAll("ol[role='feed'] > li > button")[1].trigger('click')
    await flushPromises()

    expect(wrapper.vm.showing).toBe(open_id)
    expect(wrapper.find('dialog as-figure-stub').exists()).toBe(true)
  })

  it('posts the poster id to checkout', async () => {
    const wrapper = mount_prints()
    await flushPromises()

    await wrapper.vm.buy(open_id)

    const [url, options] = global.fetch.mock.calls.at(-1)
    expect(url).toBe('/prints-checkout')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ poster_id: open_id })
  })

  it('surfaces a checkout error instead of failing silently', async () => {
    global.fetch = vi.fn((url, options) =>
      options?.method === 'POST'
        ? Promise.resolve(
            json_response({ error: 'Poster is not for sale' }, false)
          )
        : Promise.resolve(json_response({ amount: 500, currency: 'usd' }))
    )
    const wrapper = mount_prints()
    await flushPromises()

    await wrapper.vm.buy(open_id)

    expect(wrapper.vm.buy_error).toBe('Poster is not for sale')
    expect(wrapper.find("[role='alert']").text()).toBe('Poster is not for sale')
  })
})
