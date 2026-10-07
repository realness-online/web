import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import {
  enableAutoUnmount as enable_auto_unmount,
  flushPromises as flush_promises,
  mount
} from '@vue/test-utils'

vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref(null) }
})

import Pay from '@/views/Pay.vue'
import { current_user } from '@/utils/serverless'

const part = (used, limit) => ({
  used,
  limit,
  left: limit - used,
  percent: Math.floor((used / limit) * 100)
})
const free_status = (day = 1000) => ({
  plan: 'free',
  free: { day: part(day, 250000), month: part(day, 3000000) },
  paid: null,
  warn:
    day >= 225000
      ? {
          limit: 'day',
          percent: 90,
          message:
            "You've used 90% of today's free model use. Subscribe for more at https://pay.test/pay"
        }
      : null
})

enable_auto_unmount(after_each)

let calls, assign
before_each(() => {
  current_user.value = { getIdToken: async () => 'token' }
  calls = []
  assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, search: '', assign })
})

after_each(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const serve = status =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push({
        url,
        method: init.method ?? 'GET',
        auth: init.headers?.authorization
      })
      if (url === '/pay/limit') return new Response(JSON.stringify(status))
      if (url === '/pay/checkout')
        return new Response(
          JSON.stringify({ url: 'https://checkout.stripe.com/c/x' })
        )
      return new Response('', { status: 404 })
    })
  )

describe('pay page', () => {
  it('shows free use, the warning, and subscribes through Stripe', async () => {
    serve(free_status(230000))
    const page = mount(Pay)
    await flush_promises()
    expect(page.text()).toContain('Today: 230,000 of 250,000 free tokens')
    expect(page.find('[role="status"]').text()).toBe(
      "You've used 90% of today's free model use."
    )
    await page.find('button').trigger('click')
    await flush_promises()
    expect(calls.at(-1)).toMatchObject({
      url: '/pay/checkout',
      method: 'POST',
      auth: 'Bearer token'
    })
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/x')
  })

  it('a paid person sees credit and renewal, no subscribe button', async () => {
    serve({
      ...free_status(),
      plan: 'paid',
      paid: {
        credit: 5,
        used: 1.25,
        left: 3.75,
        percent: 25,
        renews: '2026-11-01T00:00:00.000Z',
        ends: '2026-11-01T00:00:00.000Z'
      }
    })
    const page = mount(Pay)
    await flush_promises()
    expect(page.text()).toContain('House model credit: $1.25 of $5.00')
    expect(page.text()).toContain('renews on 2026-11-01')
    expect(page.find('button').exists()).toBe(false)
  })

  it('signed out: no calls', async () => {
    current_user.value = null
    serve(free_status())
    mount(Pay)
    await flush_promises()
    expect(calls).toHaveLength(0)
  })
})
