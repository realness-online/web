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

const { mock_replace } = vi.hoisted(() => ({ mock_replace: vi.fn() }))
const mock_route = reactive({ path: '/chat', query: {}, meta: {} })
vi.mock('vue-router', () => ({
  useRoute: () => mock_route,
  useRouter: () => ({ replace: mock_replace })
}))
vi.mock('@/utils/serverless', () => ({
  current_user: { value: { getIdToken: async () => 'id.token' } }
}))

const ndjson = (...records) =>
  new Response(records.map(record => `${JSON.stringify(record)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' }
  })

let calls, watch_replies
before_each(() => {
  vi.stubEnv('MODE', 'development')
  mock_route.query = { actor: 'a-0123456789ab' }
  home_view.value = 'thoughts'
  wide.value = false
  calls = []
  watch_replies = [
    ndjson(
      {
        type: 'history',
        messages: [
          { role: 'user', text: 'Hi' },
          { role: 'assistant', text: 'One.\n\nSee https://example.com.' }
        ]
      },
      { type: 'user', text: 'More' },
      { type: 'delta', text: 'Two' },
      { type: 'delta', text: ' parts' },
      { type: 'assistant_end', text: 'Two parts' }
    )
  ]
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push({ url, method: init.method ?? 'GET', init })
      if (url.endsWith('/v1/startup'))
        return ndjson(
          { type: 'startup', startup_id: 'chat-startup', sequence: 0 },
          {
            type: 'actor-ready',
            startup_id: 'chat-startup',
            sequence: 1,
            actor_id: JSON.parse(init.body).actor ?? 'a-mine00000000',
            created: false
          }
        )
      if (url.endsWith('/chat/events'))
        return watch_replies.shift() ?? new Promise(() => {})
      if (url.endsWith('/chat/message')) return ndjson({ type: 'done' })
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

describe('chat page', () => {
  it('draws history, then live turns, as Messages with linked statements', async () => {
    const page = await open()
    const items = page.findAll('li[itemtype="https://schema.org/Message"]')
    expect(
      items.map(item => item.find('[itemprop="sender"]').attributes('content'))
    ).toEqual(['You', 'Realness', 'You', 'Realness'])
    expect(items[1].findAll('[itemprop="text"] > p')).toHaveLength(2)
    expect(items[1].find('a').attributes('href')).toBe('https://example.com')
    expect(items[3].text()).toContain('Two parts')
    expect(calls[0]).toMatchObject({
      url: 'https://realness-gate-639469569733.us-central1.run.app/v1/startup',
      method: 'POST'
    })
    expect(JSON.parse(calls[0].init.body)).toEqual({ actor: 'a-0123456789ab' })
    expect(calls[0].init.headers.authorization).toBe('Bearer id.token')
    const watch = calls.find(call => call.url.endsWith('/chat/events'))
    expect(watch.url).toBe(
      'https://realness-gate-639469569733.us-central1.run.app/v1/actors/a-0123456789ab/chat/events'
    )
    expect(watch.init.headers.authorization).toBe('Bearer id.token')
  })

  it('sends on Enter through the gate and keeps the draft on failure', async () => {
    const page = await open()
    const box = page.find('textarea')
    await box.setValue('Hello there')
    await box.trigger('keydown', { key: 'Enter' })
    await flush_promises()
    const sent = calls.find(call => call.url.endsWith('/chat/message'))
    expect(sent.method).toBe('POST')
    expect(
      read_contextual_message(JSON.parse(sent.init.body).message)
    ).toMatchObject({
      text: 'Hello there',
      context: { path: '/chat' }
    })
    expect(box.element.value).toBe('')

    fetch.mockImplementationOnce(async () => new Response('', { status: 502 }))
    await box.setValue('Again')
    await box.trigger('keydown', { key: 'Enter' })
    await flush_promises()
    expect(box.element.value).toBe('Again')
    expect(page.find('[role="status"]').text()).toContain('502')
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

  it('chooses an actor when none is named', async () => {
    mock_route.query = {}
    await open()
    expect(JSON.parse(calls[0].init.body)).toEqual({})
    expect(mock_replace).not.toHaveBeenCalled()
    expect(
      calls.some(call => call.url.includes('a-mine00000000/chat/events'))
    ).toBe(true)
  })
})

describe('chat markdown', () => {
  it('formats Pi markdown and shows raw HTML as text', async () => {
    watch_replies = [
      ndjson({
        type: 'history',
        messages: [
          {
            role: 'assistant',
            text: 'Run `ls`.\n\n<img src=x onerror=alert(1)>'
          }
        ]
      })
    ]
    const page = await open()
    const text = page.find('[itemprop="text"]')
    expect(text.find('code').text()).toBe('ls')
    expect(text.find('img').exists()).toBe(false)
    expect(text.text()).toContain('<img src=x onerror=alert(1)>')
  })
})

describe('chat keys', () => {
  it('Cmd+K clears the conversation view', async () => {
    const page = await open()
    expect(page.findAll('ol > li').length).toBeGreaterThan(0)
    await page.get('textarea').trigger('keydown', { key: 'k', metaKey: true })
    await page.vm.$nextTick()
    expect(page.findAll('ol > li')).toHaveLength(0)
  })
})
