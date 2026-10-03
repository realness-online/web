import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { shallowMount, flushPromises } from '@vue/test-utils'
import Print from '@/views/Print.vue'

import.meta.env.VITE_ADMIN_ID ??= '/+14151234356'
const admin_id = import.meta.env.VITE_ADMIN_ID
const created = '1700000000000'
const poster_id = `${admin_id}/posters/${created}`

const { mock_route, mock_load, mock_list, mock_history, mock_directory } =
  vi.hoisted(() => ({
    mock_route: { params: { id: '1700000000000' } },
    mock_load: vi.fn(),
    mock_list: vi.fn(),
    mock_history: vi.fn(),
    mock_directory: vi.fn()
  }))

vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>'
  }
}))

vi.mock('@/components/posters/as-figure', () => ({
  default: {
    name: 'AsFigure',
    props: ['itemid', 'pin'],
    template: '<figure />'
  }
}))

vi.mock('@/utils/itemid', async importOriginal => ({
  ...(await importOriginal()),
  load: mock_load,
  list: mock_list,
  list_history_page: mock_history
}))

vi.mock('@/persistence/Directory', () => ({ as_directory: mock_directory }))

const json_response = (body, ok = true) => ({
  ok,
  json: async () => body
})

const editions = (sold = []) => ({
  amounts: [500, 10000, 50000],
  sold,
  currency: 'usd'
})

const mount_print = () => shallowMount(Print)
const price_buttons = wrapper => wrapper.findAll('form > ol > li > button')
const table = (sold = []) => {
  global.fetch = vi.fn(() => Promise.resolve(json_response(editions(sold))))
}

beforeEach(() => {
  vi.clearAllMocks()
  mock_route.params.id = created
  mock_load.mockResolvedValue({ viewbox: '0 0 512 512' })
  mock_list.mockResolvedValue([])
  mock_history.mockResolvedValue([])
  mock_directory.mockResolvedValue({ items: [] })
  table()
  Object.defineProperty(navigator, 'share', {
    value: undefined,
    configurable: true
  })
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    configurable: true
  })
})

describe('@/views/Print', () => {
  it('shows the print, its thought, and the editions in one row', async () => {
    mock_list.mockResolvedValue([
      {
        id: `${admin_id}/statements/1700000001000`,
        type: 'thoughts',
        statement: 'the harbor at first light'
      }
    ])
    const wrapper = mount_print()
    await flushPromises()

    expect(wrapper.findComponent({ name: 'AsFigure' }).props('itemid')).toBe(
      poster_id
    )
    expect(wrapper.find('blockquote').text()).toBe('the harbor at first light')
    expect(price_buttons(wrapper)).toHaveLength(3)
    expect(price_buttons(wrapper)[0].text()).toContain('$5')
    expect(price_buttons(wrapper)[2].text()).toContain('$500')
  })

  it('marks only a sold edition, and keeps $500 open', async () => {
    table([500, 10000, 50000])
    const wrapper = mount_print()
    await flushPromises()

    expect(price_buttons(wrapper)[0].find('.sold').classes()).toContain(
      'is-sold'
    )
    expect(price_buttons(wrapper)[0].attributes('disabled')).toBeDefined()
    expect(price_buttons(wrapper)[1].attributes('disabled')).toBeDefined()
    expect(price_buttons(wrapper)[2].attributes('disabled')).toBeUndefined()
    expect(price_buttons(wrapper)[2].find('.sold').classes()).toContain(
      'is-sold'
    )
  })

  it('keeps the dot slot in every price so the row lines up', async () => {
    const wrapper = mount_print()
    await flushPromises()

    expect(
      price_buttons(wrapper).map(button => button.find('.sold').exists())
    ).toEqual([true, true, true])
    expect(price_buttons(wrapper)[0].find('.sold').classes()).not.toContain(
      'is-sold'
    )
  })

  it('asks for the editions of the poster in the address', async () => {
    const wrapper = mount_print()
    await flushPromises()

    expect(global.fetch).toHaveBeenCalledWith(
      `/prints-checkout?poster_id=${encodeURIComponent(poster_id)}`
    )
  })

  it('posts the chosen price and the poster id to checkout', async () => {
    const wrapper = mount_print()
    await flushPromises()
    await price_buttons(wrapper)[1].trigger('click')

    const [url, options] = global.fetch.mock.calls.at(-1)
    expect(url).toBe('/prints-checkout')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      poster_id,
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
    const wrapper = mount_print()
    await flushPromises()
    await price_buttons(wrapper)[0].trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe(
      'Print edition already sold'
    )
  })

  it('says nothing about prices until the shop answers', async () => {
    global.fetch = vi.fn(() => new Promise(() => {}))
    const wrapper = mount_print()
    await flushPromises()

    expect(price_buttons(wrapper)).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Checkout unavailable')
    expect(wrapper.find('a[href^="sms:"]').exists()).toBe(false)
  })

  it('does not guess prices when the quote fails', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    const wrapper = mount_print()
    await flushPromises()

    expect(price_buttons(wrapper)).toHaveLength(0)
    expect(wrapper.find('[role="status"]').text()).toBe('Checkout unavailable')
    expect(wrapper.find('a[href^="sms:"]').attributes('href')).toBe(
      `sms:${admin_id.slice(1)}`
    )
  })

  it('shares the address through the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true
    })
    const wrapper = mount_print()
    await flushPromises()
    await wrapper.find('p.shop-links button').trigger('click')

    expect(share).toHaveBeenCalledWith({
      title: 'Hand-finished print',
      url: window.location.href
    })
  })

  it('copies the address when there is no share sheet', async () => {
    const wrapper = mount_print()
    await flushPromises()
    await wrapper.find('p.shop-links button').trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      window.location.href
    )
    expect(wrapper.find('[role="status"]').text()).toBe('Link copied')
  })
})
