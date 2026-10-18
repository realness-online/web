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
import Chat from '@/views/Chat.vue'
import SupportLayout from '@/components/support-layout.vue'
import { home_view } from '@/utils/preference'
import { wide } from '@/use/home-view'
import { read_contextual_message } from '@/utils/chat-context'
import { ask } from '@/utils/explorer'

const { mock_replace } = vi.hoisted(() => ({ mock_replace: vi.fn() }))
const mock_route = reactive({ path: '/chat', query: {}, meta: {} })
vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))
vi.mock('@/utils/serverless', () => ({
  current_user: {
    value: { uid: 'person-1', getIdToken: async () => 'id.token' }
  }
}))
vi.mock('@/utils/explorer', () => ({ ask: vi.fn(), give_log: vi.fn() }))

let calls
before_each(() => {
  vi.stubEnv('MODE', 'development')
  mock_route.query = { actor: 'a-0123456789ab' }
  home_view.value = 'thoughts'
  wide.value = false
  calls = []
  ask.mockReset().mockImplementation(async ({ on_delta }) => {
    on_delta('Hello')
    return { text: 'Hello' }
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push({ url, init })
      if (url.endsWith('/v1/startup'))
        return new Response(
          `${JSON.stringify({ type: 'actor-ready', actor_id: JSON.parse(init.body).actor ?? 'a-mine00000000', startup_id: 'chat-startup', created: false })}\n`
        )
      if (url.endsWith('/chat/limit'))
        return new Response(JSON.stringify({ warn: null }))
      throw new Error(`Unexpected request: ${url}`)
    })
  )
})
after_each(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  localStorage.clear()
  home_view.value = 'thoughts'
})
enable_auto_unmount(after_each)

const open = async () => {
  const page = mount(SupportLayout, {
    attachTo: document.body,
    global: {
      stubs: {
        RouterLink: true,
        'router-view': { components: { Chat }, template: '<Chat />' }
      }
    }
  })
  await flush_promises()
  return page
}
const submit = async (page, message) => {
  const box = page.get('textarea')
  await box.setValue(message)
  await box.trigger('keydown', { key: 'Enter' })
  await flush_promises()
}

describe('chat page', () => {
  it('draws browser turns as Messages with linked statements without subscribing to VM history', async () => {
    ask
      .mockResolvedValueOnce({ text: 'One.\n\nSee https://example.com.' })
      .mockResolvedValueOnce({ text: 'Two parts' })
    const page = await open()
    await submit(page, 'Hi')
    await submit(page, 'More')
    const items = page.findAll('li[itemtype="https://schema.org/Message"]')
    expect(
      items.map(item => item.find('[itemprop="sender"]').attributes('content'))
    ).toEqual(['You', 'Realness', 'You', 'Realness'])
    expect(items[1].findAll('[itemprop="text"] > p')).toHaveLength(2)
    expect(items[1].find('a').attributes('href')).toBe('https://example.com')
    expect(items[3].text()).toContain('Two parts')
    expect(calls.some(call => call.url.endsWith('/chat/events'))).toBe(false)
  })

  it('sends on Enter with page context and restores the draft after a browser failure', async () => {
    const page = await open()
    await submit(page, 'Hello there')
    expect(read_contextual_message(ask.mock.calls[0][0].text)).toMatchObject({
      text: 'Hello there',
      context: { path: '/chat' }
    })
    expect(page.get('textarea').element.value).toBe('')
    ask.mockRejectedValueOnce(new Error('Model connection failed'))
    await submit(page, 'Again')
    expect(page.get('textarea').element.value).toBe('Again')
    expect(page.get('#chat-panel [role="status"]').text()).toBe(
      'Model connection failed'
    )
  })

  it('shows the message box without connecting the TUI when narrow', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {}
    }))
    const page = await open()
    expect(page.find('form > textarea[aria-label="Message"]').exists()).toBe(
      true
    )
    expect(page.find('section[data-terminal]').exists()).toBe(false)
    expect(page.get('#chat-panel').attributes('data-alone')).toBeDefined()
    expect(calls.some(call => call.url.includes('/pty'))).toBe(false)
  })

  it('does not switch chat to an automatically selected terminal actor', async () => {
    mock_route.query = {}
    const page = await open()
    expect(JSON.parse(calls[0].init.body)).toEqual({})
    expect(mock_replace).not.toHaveBeenCalled()
    await submit(page, 'Hello')
    expect(ask).toHaveBeenCalledOnce()
    expect(calls.some(call => call.url.includes('/chat/events'))).toBe(false)
  })
})

describe('chat markdown', () => {
  it('formats browser markdown and shows raw HTML as text', async () => {
    ask.mockResolvedValueOnce({
      text: 'Run `ls`.\n\n<img src=x onerror=alert(1)>'
    })
    const page = await open()
    await submit(page, 'Show me')
    const text = page.findAll('[itemprop="text"]').at(-1)
    expect(text.find('code').text()).toBe('ls')
    expect(text.find('img').exists()).toBe(false)
    expect(text.text()).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('chat keys', () => {
  it('Cmd+K clears the conversation view', async () => {
    const page = await open()
    await submit(page, 'Hello')
    expect(page.findAll('ol > li').length).toBeGreaterThan(0)
    await page.get('textarea').trigger('keydown', { key: 'k', metaKey: true })
    await page.vm.$nextTick()
    expect(page.findAll('ol > li')).toHaveLength(0)
  })
})
