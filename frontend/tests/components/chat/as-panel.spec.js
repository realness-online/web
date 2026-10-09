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
  return { current_user: ref({ getIdToken: async () => 'id.token' }) }
})

import AsPanel from '@/components/chat/as-panel.vue'
import { home_view } from '@/utils/preference'
import { use_home_view } from '@/use/home-view'

const ndjson = (...records) =>
  new Response(records.map(record => `${JSON.stringify(record)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' }
  })

let calls
before_each(() => {
  vi.stubEnv('VITE_BRAYNESS_GATE_URL', 'https://gate.test')
  calls = []
  let watched = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async url => {
      calls.push(url)
      if (url.endsWith('/chat/events')) {
        if (watched) return new Promise(() => {})
        watched = true
        return ndjson({
          type: 'history',
          messages: [{ role: 'user', text: 'Hi' }]
        })
      }
      return new Response(JSON.stringify({ warn: null }))
    })
  )
})

after_each(() => {
  home_view.value = 'thoughts'
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

enable_auto_unmount(after_each)

const open_panel = (props = { actor: 'a-mine00000000' }) =>
  mount(AsPanel, { props, global: { stubs: { RouterLink: true } } })

describe('@/components/chat/as-panel', () => {
  it('stays unconnected and inert while the homepage shows only thoughts', async () => {
    home_view.value = 'thoughts'
    const panel = open_panel()
    await flush_promises()
    expect(calls).toHaveLength(0)
    expect(panel.find('aside').attributes('inert')).toBeDefined()
    expect(panel.find('aside').attributes('data-open')).toBeUndefined()
  })

  it('connects when chat shows and draws the conversation', async () => {
    home_view.value = 'chat'
    const panel = open_panel()
    await flush_promises()
    expect(calls.some(url => url.endsWith('/chat/events'))).toBe(true)
    expect(panel.find('aside').attributes('data-open')).toBeDefined()
    expect(panel.find('aside').attributes('data-alone')).toBeDefined()
    expect(panel.find('aside').attributes('inert')).toBeUndefined()
    expect(panel.find('ol > li').text()).toContain('Hi')
  })

  it('waits for an actor before connecting', async () => {
    home_view.value = 'chat'
    const panel = open_panel({ actor: null })
    await flush_promises()
    expect(calls).toHaveLength(0)
    await panel.setProps({ actor: 'a-mine00000000' })
    await flush_promises()
    expect(calls.some(url => url.endsWith('/chat/events'))).toBe(true)
  })

  it('shows a problem finding the actor in its status line', async () => {
    home_view.value = 'chat'
    const panel = open_panel({ actor: null, problem: 'No machine yet' })
    await flush_promises()
    expect(panel.find('p[role="status"]').text()).toBe('No machine yet')
  })

  it('shows the status in the box below the conversation', async () => {
    home_view.value = 'chat'
    const panel = open_panel({ actor: null, problem: 'No machine yet' })
    await flush_promises()
    const box = panel.find('aside#chat-panel > aside')
    expect(box.find('p[role="status"]').text()).toBe('No machine yet')
    expect(box.attributes('aria-hidden')).toBeUndefined()
  })

  it('shows the community toggle only while thoughts show', async () => {
    home_view.value = 'chat'
    const alone = open_panel()
    await flush_promises()
    expect(alone.find('button[itemprop="feed_filter"]').exists()).toBe(false)
    // Thoughts beside chat needs a wide screen.
    use_home_view().wide.value = true
    home_view.value = 'chat-thoughts'
    await flush_promises()
    expect(alone.find('button[itemprop="feed_filter"]').exists()).toBe(true)
    use_home_view().wide.value = false
  })

  it('Escape asks to leave; Cmd+K clears the view', async () => {
    home_view.value = 'chat'
    const panel = open_panel()
    await flush_promises()
    await panel.find('aside').trigger('keydown', { key: 'Escape' })
    expect(panel.emitted('leave')).toHaveLength(1)
    await panel.find('aside').trigger('keydown', { key: 'k', metaKey: true })
    expect(panel.findAll('ol > li')).toHaveLength(0)
  })
})
