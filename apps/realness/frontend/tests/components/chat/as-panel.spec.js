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
import { home_view, info } from '@/utils/preference'
import { use_home_view } from '@/use/home-view'

const ndjson = (...records) =>
  new Response(records.map(record => `${JSON.stringify(record)}\n`).join(''), {
    headers: { 'content-type': 'application/x-ndjson' }
  })

let calls
before_each(() => {
  vi.stubEnv('MODE', 'development')
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
  info.value = false
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

enable_auto_unmount(after_each)

const open_panel = (props = { actor: 'a-mine00000000' }) =>
  mount(AsPanel, { props, global: { stubs: { RouterLink: true } } })

describe('@/components/chat/as-panel', () => {
  it('places enabled info inside the chat buffer', async () => {
    home_view.value = 'chat'
    info.value = true
    const panel = mount(AsPanel, {
      props: { actor: null },
      global: {
        stubs: {
          AsFps: { template: '<aside id="fps">Info</aside>' },
          RouterLink: true
        }
      }
    })
    await flush_promises()
    expect(panel.find('aside[aria-label="Status"] > #fps').exists()).toBe(true)
  })

  it('does not mount info while chat is closed', async () => {
    home_view.value = 'thoughts'
    info.value = true
    const panel = mount(AsPanel, {
      props: { actor: null },
      global: {
        stubs: {
          AsFps: { template: '<aside id="fps">Info</aside>' },
          RouterLink: true
        }
      }
    })
    await flush_promises()
    expect(panel.find('#fps').exists()).toBe(false)
  })

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
    expect(panel.find('ol > li').text()).toBe('Hi')
    expect(
      panel.find('ol > li > meta[itemprop="sender"]').attributes('content')
    ).toBe('You')
  })

  it('focuses the message when the opening transition starts', async () => {
    home_view.value = 'thoughts'
    const panel = mount(AsPanel, {
      attachTo: document.body,
      props: { actor: null },
      global: { stubs: { RouterLink: true } }
    })
    home_view.value = 'chat'
    await flush_promises()
    panel.find('textarea').element.blur()
    await panel.find('#chat-panel').trigger('transitionstart', {
      propertyName: 'visibility'
    })
    expect(document.activeElement).toBe(panel.find('textarea').element)

    home_view.value = 'thoughts'
    await flush_promises()
    panel.find('textarea').element.blur()
    await panel.find('#chat-panel').trigger('transitionstart', {
      propertyName: 'visibility'
    })
    expect(document.activeElement).not.toBe(panel.find('textarea').element)
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

  it('keeps the input open while a lookup failure offers Retry', async () => {
    home_view.value = 'chat'
    const panel = open_panel({ actor: null, problem: 'Realness answered 502' })
    await flush_promises()
    const feedback = panel.get('section[aria-label="Connection status"]')
    expect(feedback.get('[role="alert"]').text()).toBe('Realness answered 502')
    expect(panel.find('textarea').exists()).toBe(true)
    await feedback.get('button').trigger('click')
    expect(panel.emitted('retry')).toHaveLength(1)
    await panel.setProps({ problem: '', finding: true })
    expect(panel.find('section[aria-label="Connection status"]').exists()).toBe(
      false
    )
    expect(panel.find('textarea').exists()).toBe(true)
  })

  it('looks ready while chat starts, with no startup display', async () => {
    home_view.value = 'chat'
    let finish
    fetch.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const panel = open_panel({
      actor: 'a-mine00000000',
      startup_id: 'host-startup'
    })
    await flush_promises()
    expect(panel.find('textarea').exists()).toBe(true)
    expect(panel.find('section[aria-label="Connection status"]').exists()).toBe(
      false
    )
    expect(panel.get('[role="status"]').text()).toBe('')
    finish(ndjson({ type: 'history', messages: [] }))
    await flush_promises()
    expect(panel.find('textarea').exists()).toBe(true)
  })

  it('retries an initial chat failure beside the open input', async () => {
    home_view.value = 'chat'
    fetch.mockResolvedValueOnce(new Response('', { status: 502 }))
    const panel = open_panel()
    await flush_promises()
    expect(panel.get('[role="alert"]').text()).toBe('Realness answered 502')
    expect(panel.find('textarea').exists()).toBe(true)
    await panel
      .get('section[aria-label="Connection status"] button')
      .trigger('click')
    await flush_promises()
    expect(panel.find('section[aria-label="Connection status"]').exists()).toBe(
      false
    )
  })

  it('shows the status in the box below the conversation', async () => {
    home_view.value = 'chat'
    const panel = open_panel({ actor: null })
    await flush_promises()
    const box = panel.find('aside#chat-panel > aside')
    expect(box.find('p[role="status"]').exists()).toBe(true)
    expect(box.attributes('aria-hidden')).toBeUndefined()
  })

  it('shows the community toggle only while thoughts show', async () => {
    home_view.value = 'chat'
    const alone = open_panel()
    await flush_promises()
    expect(alone.find('button[itemprop="feed_filter"]').exists()).toBe(false)
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
