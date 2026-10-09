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
import { reactive } from 'vue'

const mock_route = reactive({ query: {} })
vi.mock('vue-router', () => ({ useRoute: () => mock_route }))
vi.mock('@/utils/serverless', async () => {
  const { ref } = await import('vue')
  return { current_user: ref({ getIdToken: async () => 'id.token' }) }
})

import AsWorkspace from '@/components/chat/as-workspace.vue'
import { use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'

let calls
before_each(() => {
  vi.stubEnv('VITE_BRAYNESS_GATE_URL', 'https://gate.test')
  mock_route.query = {}
  home_view.value = 'thoughts'
  use_home_view().wide.value = true
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async url => {
      calls.push(url)
      if (url.endsWith('/chat/events')) return new Promise(() => {})
      return new Response(
        JSON.stringify({ actors: [{ id: 'a-mine00000000' }], warn: null })
      )
    })
  )
})

after_each(() => {
  home_view.value = 'thoughts'
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

enable_auto_unmount(after_each)

const open = async () => {
  const page = mount(AsWorkspace, {
    global: { stubs: { AsTui: { template: '<section><slot /></section>' } } }
  })
  await flush_promises()
  return page
}

const press = init =>
  window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, ...init }))

describe('@/components/chat/as-workspace', () => {
  it('finds the actor only once chat or the TUI shows', async () => {
    await open()
    expect(calls).toHaveLength(0)
    press({ code: 'KeyC' })
    await flush_promises()
    expect(home_view.value).toBe('chat-thoughts')
    expect(calls.some(url => url.includes('/actors'))).toBe(true)
  })

  it('takes the actor from the address when named', async () => {
    mock_route.query = { actor: 'a-named0000000' }
    home_view.value = 'chat'
    await open()
    expect(calls.some(url => url.includes('a-named0000000'))).toBe(true)
  })

  it('Option+1 to 5 pick a layout; Option+C brings chat in or out', async () => {
    await open()
    press({ code: 'Digit5' })
    expect(home_view.value).toBe('tui')
    press({ code: 'KeyC' })
    expect(home_view.value).toBe('chat-tui')
    press({ code: 'Digit3' })
    expect(home_view.value).toBe('chat')
    press({ code: 'Digit1' })
    expect(home_view.value).toBe('thoughts')
  })

  it('ignores TUI layouts on a narrow screen', async () => {
    use_home_view().wide.value = false
    await open()
    press({ code: 'Digit5' })
    expect(home_view.value).toBe('thoughts')
  })
})
