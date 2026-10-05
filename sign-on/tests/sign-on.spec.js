import { afterEach as after_each, beforeEach as before_each, describe, expect, it, vi } from 'vitest'
import { flushPromises as flush_promises, mount } from '@vue/test-utils'
import { nextTick as next_tick } from 'vue'

const mocks = vi.hoisted(() => ({
  hand_off: vi.fn()
}))

vi.mock('@/utils/hand-off', async importOriginal => ({
  ...(await importOriginal()),
  hand_off: mocks.hand_off
}))

vi.mock('@/utils/firebase', async () => {
  const { ref } = await import('vue')
  return {
    init_auth: vi.fn(),
    recaptcha: vi.fn(),
    sign_in: vi.fn(),
    current_user: ref(null)
  }
})

import SignOn from '@/sign-on.vue'
import { current_user } from '@/utils/firebase'

const state = 'c'.repeat(32)

before_each(() => {
  vi.clearAllMocks()
  current_user.value = null
})

after_each(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sign-on page', () => {
  it('shows the form when nothing is waiting', () => {
    const page = mount(SignOn, { props: { query: {} } })
    expect(page.find('#mobile').exists()).toBe(true)
    expect(page.find('#send-to-terminal').exists()).toBe(false)
    expect(page.find('#open-terminal').exists()).toBe(false)
  })

  it('offers the terminal button to a waiting program once signed in', async () => {
    current_user.value = { refreshToken: 'r' }
    const page = mount(SignOn, { props: { query: { cli: '53124', state } } })
    await next_tick()

    expect(page.find('#send-to-terminal').exists()).toBe(true)
    expect(page.find('#mobile').exists()).toBe(false)
  })

  it('posts the sign-in to the waiting program on a click', async () => {
    vi.stubEnv('VITE_API_KEY', 'test-key')
    current_user.value = { refreshToken: 'refresh' }
    const page = mount(SignOn, { props: { query: { cli: '53124', state } } })
    await next_tick()

    await page.find('#send-to-terminal').trigger('click')

    expect(mocks.hand_off).toHaveBeenCalledWith(
      { port: 53124, state },
      { refresh_token: 'refresh', api_key: 'test-key' }
    )
  })

  it('goes straight to the chat once signed in, carrying the pass', async () => {
    vi.stubEnv('VITE_BRAYNESS_URL', 'http://terminal.example')
    vi.stubEnv('VITE_BRAYNESS_SYNC_URL', 'http://sync.example')
    current_user.value = { getIdToken: vi.fn().mockResolvedValue('id-token') }
    const replace = vi.fn()
    vi.stubGlobal('location', { replace })
    const fetch_mock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ pass: 'P/+' }) })
    vi.stubGlobal('fetch', fetch_mock)

    const page = mount(SignOn, { props: { query: {} } })
    await flush_promises()

    expect(fetch_mock).toHaveBeenCalledWith('http://sync.example/v1/host-pass', {
      method: 'POST',
      headers: { authorization: 'Bearer id-token' }
    })
    expect(replace).toHaveBeenCalledWith(
      'http://terminal.example/handoff?next=chat#pass=P%2F%2B'
    )
    expect(page.find('#open-terminal').exists()).toBe(false)
    expect(page.find('#mobile').exists()).toBe(false)
  })

  it('offers a retry when the pass fails', async () => {
    vi.stubEnv('VITE_BRAYNESS_URL', 'http://terminal.example')
    vi.stubEnv('VITE_BRAYNESS_SYNC_URL', 'http://sync.example')
    current_user.value = { getIdToken: vi.fn().mockResolvedValue('id-token') }
    vi.stubGlobal('location', { replace: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const page = mount(SignOn, { props: { query: {} } })
    await flush_promises()

    expect(page.find('[role="alert"]').text()).toBe('Could not open Brayness')
    expect(page.find('#open-chat').text()).toBe('Try again')
  })
})
