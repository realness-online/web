import {
  afterEach as after_each,
  beforeEach as before_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { ref } from 'vue'
import { mount, flushPromises as flush_promises } from '@vue/test-utils'
import AsPanel from '@/components/chat/as-panel.vue'
import AsWorkspace from '@/components/chat/as-workspace.vue'
import { use_home_view } from '@/use/home-view'
import { home_view } from '@/utils/preference'
import * as idb from 'fake-indexeddb'
import { use_chat } from '@/use/chat'
import * as explorer from '@/utils/explorer'

vi.mock('@/utils/serverless', () => ({
  current_user: {
    value: {
      uid: 'durable-chat-person',
      getIdToken: async () => 'person-token'
    }
  }
}))

const user = {
  uid: 'durable-chat-person',
  getIdToken: async () => 'person-token'
}
const requests = []
let replies
let chats
let pages
let startup_error
let startup_pending
let execute

const bash_reply = () => ({
  tool_calls: [
    {
      index: 0,
      id: 'call-bash',
      type: 'function',
      function: {
        name: 'bash',
        arguments: JSON.stringify({ command: 'pwd' })
      }
    }
  ]
})

const completion = delta => {
  const chunk = {
    id: 'completion-1',
    object: 'chat.completion.chunk',
    created: 1,
    model: 'inkling',
    choices: [
      { index: 0, delta: { role: 'assistant', ...delta }, finish_reason: null }
    ]
  }
  const end = {
    ...chunk,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: delta.tool_calls ? 'tool_calls' : 'stop'
      }
    ]
  }
  return new Response(
    `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`,
    {
      headers: { 'content-type': 'text/event-stream' }
    }
  )
}
const frames = values =>
  new Response(values.map(value => `${JSON.stringify(value)}\n`).join(''))
const chat = () => {
  const value = use_chat(ref(null))
  chats.push(value)
  return value
}
const send = async (value, text) => {
  value.draft.value = text
  await value.send()
  expect(value.status.value).toBe('')
}

before_each(() => {
  vi.stubEnv('MODE', 'development')
  for (const [name, value] of Object.entries(idb))
    if (name.startsWith('IDB') || name === 'indexedDB')
      vi.stubGlobal(name, value)
  requests.length = 0
  chats = []
  pages = []
  replies = []
  startup_error = null
  startup_pending = null
  execute = () =>
    frames([
      { type: 'output', stream: 'stdout', data_b64: btoa('/realness\n') },
      { type: 'exit', exit_code: 0 }
    ])
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      const body = JSON.parse(init.body)
      requests.push({ url: String(url), body, init })
      if (String(url).endsWith('/chat/completions')) {
        const next = replies.shift()
        if (!next) throw new Error('Unexpected model request')
        return completion(next)
      }
      if (String(url).endsWith('/v1/startup')) {
        if (startup_pending) return startup_pending
        if (startup_error) return new Response(startup_error, { status: 503 })
        return frames([
          {
            type: 'actor-ready',
            actor_id: 'a-browser-tools',
            startup_id: 'startup-1'
          }
        ])
      }
      if (String(url).endsWith('/v1/actors/a-browser-tools/exec'))
        return execute(init)
      throw new Error(`Unexpected request: ${url}`)
    })
  )
})

after_each(async () => {
  for (const page of pages) page.unmount()
  home_view.value = 'thoughts'
  await Promise.all(chats.map(value => value.stop()))
  await explorer.close()
  await new Promise((resolve, reject) => {
    const deletion = indexedDB.deleteDatabase(
      `realness-explorer-${encodeURIComponent(user.uid)}`
    )
    deletion.onsuccess = resolve
    deletion.onerror = () => reject(deletion.error)
  })
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const WAIT = { timeout: 10_000, interval: 50 }
const wait_for = expectation => vi.waitFor(expectation, WAIT)

describe('chat with the real Durable browser bundle', () => {
  it('answers while the VM warms in the background and keeps answering if warm-up fails', async () => {
    let finish_startup
    startup_pending = new Promise(resolve => {
      finish_startup = resolve
    })
    home_view.value = 'chat-thoughts'
    use_home_view().wide.value = true
    const page = mount(AsWorkspace, {
      global: {
        stubs: {
          RouterLink: true,
          AsTui: {
            name: 'AsTui',
            props: ['actor', 'finding', 'problem'],
            template: '<section />'
          }
        }
      }
    })
    pages.push(page)
    await wait_for(() =>
      expect(
        requests.filter(request => request.url.endsWith('/v1/startup'))
      ).toHaveLength(1)
    )
    const terminal = page.findComponent({ name: 'AsTui' })
    expect(terminal.props('finding')).toBe(true)
    replies.push({ content: 'Chat is ready before the VM.' })
    await page.get('textarea[name="message"]').setValue('Hello.')
    await page.get('form[data-chat]').trigger('submit')
    await wait_for(() =>
      expect(page.get('#chat-panel ol').text()).toContain(
        'Chat is ready before the VM.'
      )
    )
    expect(terminal.props('finding')).toBe(true)
    expect(terminal.props('actor')).toBe(null)
    finish_startup(new Response('Warm-up unavailable', { status: 503 }))
    await flush_promises()
    expect(terminal.props('problem')).toContain('Warm-up unavailable')
    expect(page.get('#chat-panel [role="status"]').text()).toBe('')
    expect(page.find('#chat-panel [role="alert"]').exists()).toBe(false)
    replies.push({ content: 'We can still talk.' })
    await page.get('textarea[name="message"]').setValue('Can we still talk?')
    await page.get('form[data-chat]').trigger('submit')
    await wait_for(() =>
      expect(page.get('#chat-panel ol').text()).toContain('We can still talk.')
    )
    expect(
      requests.filter(request => request.url.endsWith('/v1/startup'))
    ).toHaveLength(1)
  })

  it('submits through the chat form and renders a VM result without transferring the log', async () => {
    home_view.value = 'chat'
    const page = mount(AsPanel, { global: { stubs: { RouterLink: true } } })
    pages.push(page)
    await explorer.explorer(user.getIdToken, user.uid)
    await flush_promises()
    expect(requests).toHaveLength(0)
    replies.push(bash_reply(), { content: 'The VM returned /realness.' })
    await page.get('textarea[name="message"]').setValue('Run pwd.')
    await page.get('form[data-chat]').trigger('submit')
    await wait_for(() =>
      expect(page.get('ol').text()).toContain('The VM returned /realness.')
    )
    expect(
      requests.filter(request => request.url.endsWith('/exec'))
    ).toHaveLength(1)
    expect(
      requests.some(request =>
        /session\/log|chat\/send|chat\/events/.test(request.url)
      )
    ).toBe(false)
  })

  it('keeps chat usable after VM startup fails', async () => {
    const value = chat()
    startup_error = 'VM unavailable'
    replies.push(bash_reply(), {
      content: 'The VM is unavailable; the conversation is still here.'
    })
    await send(value, 'Run pwd.')
    const session = await explorer.explorer(user.getIdToken, user.uid)
    const context = await session.root.context(session.pi.BACKGROUND_CONTEXT)
    expect(
      context.messages.some(
        message =>
          message.role === 'toolResult' &&
          message.isError &&
          JSON.stringify(message.content).includes('VM unavailable')
      )
    ).toBe(true)
    expect(
      requests.filter(request => request.url.endsWith('/exec'))
    ).toHaveLength(0)
    replies.push({ content: 'We can still talk.' })
    await send(value, 'Can we still talk?')
    expect(value.messages.value.at(-1).text).toBe('We can still talk.')
    expect(
      requests.filter(request => request.url.endsWith('/v1/startup'))
    ).toHaveLength(1)
  })

  it('stopping chat cancels its VM request without resending the command', async () => {
    let signal
    execute = init =>
      new Response(
        new ReadableStream({
          start(controller) {
            signal = init.signal
            controller.enqueue(
              new TextEncoder().encode(
                `${JSON.stringify({ type: 'output', stream: 'stdout', data_b64: btoa('early') })}\n`
              )
            )
            signal.addEventListener(
              'abort',
              () => controller.error(new DOMException('stopped', 'AbortError')),
              { once: true }
            )
          }
        })
      )
    const value = chat()
    replies.push(bash_reply())
    value.draft.value = 'Run pwd.'
    const pending = value.send()
    await wait_for(() => expect(signal).toBeDefined())
    await value.stop()
    await pending
    expect(signal.aborted).toBe(true)
    expect(value.working.value).toBe(false)
    expect(
      requests.filter(request => request.url.endsWith('/exec'))
    ).toHaveLength(1)
    expect(replies).toHaveLength(0)
  })

  it('reports interrupted bash after reopen instead of running it twice', async () => {
    let signal
    execute = init =>
      new Response(
        new ReadableStream({
          start(controller) {
            signal = init.signal
            signal.addEventListener(
              'abort',
              () => controller.error(new DOMException('closed', 'AbortError')),
              { once: true }
            )
          }
        })
      )
    const value = chat()
    replies.push(bash_reply())
    value.draft.value = 'Run pwd.'
    const pending = value.send()
    await wait_for(() => expect(signal).toBeDefined())
    await explorer.close()
    await pending
    expect(signal.aborted).toBe(true)
    replies.push(
      ...Array.from({ length: 3 }, () => ({
        content: 'The earlier command was interrupted.'
      }))
    )
    const reopened = chat()
    await send(reopened, 'What happened?')
    expect(
      requests.filter(request => request.url.endsWith('/exec'))
    ).toHaveLength(1)
    const session = await explorer.explorer(user.getIdToken, user.uid)
    const context = await session.root.context(session.pi.BACKGROUND_CONTEXT)
    expect(
      context.messages.some(
        message =>
          message.role === 'toolResult' &&
          message.isError &&
          /interrupted/i.test(JSON.stringify(message.content))
      )
    ).toBe(true)
  })

  it('new session resets browser context without changing terminal Pi', async () => {
    const value = chat()
    replies.push({ content: 'I remember cedar.' })
    await send(value, 'Remember cedar.')
    value.draft.value = '/new'
    await value.send()
    expect(value.messages.value).toEqual([])
    expect(value.status.value).toBe('New session')
    replies.push({ content: 'A new conversation.' })
    await send(value, 'Hello.')
    const model = requests
      .filter(request => request.url.endsWith('/chat/completions'))
      .at(-1)
    expect(JSON.stringify(model.body.messages)).not.toContain('Remember cedar.')
    expect(
      requests.every(request => request.url.endsWith('/chat/completions'))
    ).toBe(true)
  })

  it('runs bash through the relay and reopens the same browser transcript', async () => {
    const value = chat()
    replies.push({ content: 'I remember cedar.' })
    await send(value, 'Remember cedar.')
    expect(
      requests.every(request => request.url.endsWith('/chat/completions'))
    ).toBe(true)

    replies.push({
      tool_calls: [
        {
          index: 0,
          id: 'call-bash',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({ command: 'pwd' })
          }
        }
      ]
    })
    replies.push({ content: '/realness. I still remember cedar.' })
    await send(value, 'Run pwd.')
    const exec = requests.find(request => request.url.endsWith('/exec'))
    expect(exec?.body.argv).toEqual(['/bin/bash', '-c', 'pwd'])
    expect(exec?.body.cwd).toBe('/realness')
    expect(exec?.init.headers.authorization).toBe('Bearer person-token')
    expect(
      requests
        .filter(request => !request.url.endsWith('/chat/completions'))
        .map(request => new URL(request.url).pathname)
    ).toEqual(['/v1/startup', '/v1/actors/a-browser-tools/exec'])
    expect(value.messages.value.map(message => message.text)).toEqual([
      'Remember cedar.',
      'I remember cedar.',
      'Run pwd.',
      '/realness. I still remember cedar.'
    ])
    const session = await explorer.explorer(user.getIdToken, user.uid)
    const before = await session.root.context(session.pi.BACKGROUND_CONTEXT)
    expect(
      before.messages.some(
        message =>
          message.role === 'toolResult' &&
          JSON.stringify(message.content).includes('/realness')
      )
    ).toBe(true)
    const root_id = session.root.id
    await value.stop()
    await explorer.close()

    const reopened = chat()
    await reopened.watch()
    expect(reopened.messages.value.map(message => message.text)).toEqual(
      value.messages.value.map(message => message.text)
    )
    replies.push({ content: 'cedar' })
    await send(reopened, 'What word?')
    const after = await explorer.explorer(user.getIdToken, user.uid)
    expect(after.root.id).toBe(root_id)
    const model = requests
      .filter(request => request.url.endsWith('/chat/completions'))
      .at(-1)
    expect(JSON.stringify(model.body.messages)).toContain('Remember cedar.')
    expect(JSON.stringify(model.body.messages)).toContain('/realness')
    expect(reopened.messages.value.at(-1).text).toBe('cedar')
  })
})
