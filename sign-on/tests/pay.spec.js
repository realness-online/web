import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

vi.mock('@/utils/firebase', async () => {
  const { ref } = await import('vue')
  return { init_auth: vi.fn(), recaptcha: vi.fn(), sign_in: vi.fn(), current_user: ref(null) }
})

import Pay from '@/pay.vue'
import { current_user } from '@/utils/firebase'

const part = (used, limit) => ({ used, limit, left: limit - used, percent: Math.floor((used / limit) * 100) })
const free_status = (day = 1000) => ({
  plan: 'free',
  free: { day: part(day, 250000), month: part(day, 3000000) },
  paid: null,
  warn: day >= 225000 ? { limit: 'day', percent: 90, message: "You've used 90% of today's free model use. Subscribe for more at https://pay.test/pay" } : null
})

enableAutoUnmount(afterEach)

let calls, assign
beforeEach(() => {
  vi.stubEnv('VITE_BRAYNESS_PROXY_URL', 'https://proxy.test')
  current_user.value = { getIdToken: async () => 'token' }
  calls = []
  assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, search: '', assign })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const serve = status =>
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', auth: init.headers?.authorization })
    if (url.endsWith('/limit')) return new Response(JSON.stringify(status))
    if (url.endsWith('/pay/checkout')) return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/x' }))
    return new Response('', { status: 404 })
  }))

describe('pay page', () => {
  it('shows free use, the warning, and subscribes through Stripe', async () => {
    serve(free_status(230000))
    const page = mount(Pay)
    await flushPromises()
    expect(page.text()).toContain('Today: 230,000 of 250,000 free tokens')
    expect(page.find('[role="status"]').text()).toBe("You've used 90% of today's free model use.")
    await page.find('button').trigger('click')
    await flushPromises()
    expect(calls.at(-1)).toMatchObject({ url: 'https://proxy.test/pay/checkout', method: 'POST', auth: 'Bearer token' })
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/x')
  })

  it('a paid person sees credit and renewal, no subscribe button', async () => {
    serve({ ...free_status(), plan: 'paid', paid: { credit: 5, used: 1.25, left: 3.75, percent: 25, renews: '2026-11-01T00:00:00.000Z', ends: '2026-11-01T00:00:00.000Z' } })
    const page = mount(Pay)
    await flushPromises()
    expect(page.text()).toContain('House model credit: $1.25 of $5.00')
    expect(page.text()).toContain('renews on 2026-11-01')
    expect(page.find('button').exists()).toBe(false)
  })

  it('signed out: the sign-in form, no calls', async () => {
    current_user.value = null
    serve(free_status())
    const page = mount(Pay, { global: { stubs: { AsSignOn: { template: '<form id="sign-in" />' } } } })
    await flushPromises()
    expect(page.find('#sign-in').exists()).toBe(true)
    expect(calls).toHaveLength(0)
  })
})
