import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'

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

beforeEach(() => {
  vi.clearAllMocks()
  current_user.value = null
})

afterEach(() => {
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
    await nextTick()

    expect(page.find('#send-to-terminal').exists()).toBe(true)
    expect(page.find('#mobile').exists()).toBe(false)
  })

  it('posts the sign-in to the waiting program on a click', async () => {
    vi.stubEnv('VITE_API_KEY', 'test-key')
    current_user.value = { refreshToken: 'refresh' }
    const page = mount(SignOn, { props: { query: { cli: '53124', state } } })
    await nextTick()

    await page.find('#send-to-terminal').trigger('click')

    expect(mocks.hand_off).toHaveBeenCalledWith(
      { port: 53124, state },
      { refresh_token: 'refresh', api_key: 'test-key' }
    )
  })

  it('offers the browser handoff when the terminal asks for one', async () => {
    current_user.value = { getIdToken: vi.fn() }
    const page = mount(SignOn, { props: { query: { handoff: '1' } } })
    await nextTick()

    expect(page.find('#open-terminal').exists()).toBe(true)
    expect(page.find('#open-chat').exists()).toBe(true)
    expect(page.find('#mobile').exists()).toBe(false)
  })

  it('opens the handoff, fetches a pass, and posts it to the terminal', async () => {
    vi.stubEnv('VITE_BRAYNESS_URL', 'http://terminal.example')
    vi.stubEnv('VITE_BRAYNESS_SYNC_URL', 'http://sync.example')
    current_user.value = { getIdToken: vi.fn().mockResolvedValue('id-token') }
    const opened = { postMessage: vi.fn(), close: vi.fn(), location: {} }
    const open = vi.spyOn(window, 'open').mockReturnValue(opened)
    const fetch_mock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ pass: 'P' }) })
    vi.stubGlobal('fetch', fetch_mock)

    const page = mount(SignOn, { props: { query: { handoff: '1' } } })
    await nextTick()
    await page.find('#open-terminal').trigger('click')
    await flushPromises()

    expect(open).toHaveBeenCalledWith('http://terminal.example/handoff', '_blank')
    expect(fetch_mock).toHaveBeenCalledWith('http://sync.example/v1/host-pass', {
      method: 'POST',
      headers: { authorization: 'Bearer id-token' }
    })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'brayness-ready' },
        origin: 'http://terminal.example',
        source: opened
      })
    )

    expect(opened.postMessage).toHaveBeenCalledWith(
      { type: 'brayness-pass', pass: 'P' },
      'http://terminal.example'
    )
    await page.find('#open-chat').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenLastCalledWith('http://terminal.example/handoff?next=chat', '_blank')
    expect(opened.location.href).toBe('http://terminal.example/handoff?next=chat')
  })
})
