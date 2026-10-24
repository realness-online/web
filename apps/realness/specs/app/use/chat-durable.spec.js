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
/** Calls to the gate's live view, kept apart from model and VM calls. */
const views = []
const EMPTY_VIEW = { type: 'view', writer: null, tail: 0, lines: [] }
let view_now = EMPTY_VIEW
let views_offline = false
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
  views.length = 0
  view_now = EMPTY_VIEW
  views_offline = false
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
      if (new URL(String(url)).pathname.startsWith('/v1/view')) {
        views.push({ url: String(url), init })
        if (init?.method === 'POST') {
          if (views_offline) throw new TypeError('Failed to fetch')
          return new Response('{}', { status: 200 })
        }
        return frames([view_now])
      }
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
  explorer.reset_owner()
  await Promise.all(others.splice(0).map(other => other.close()))
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

const DATABASE = `realness-explorer-${encodeURIComponent(user.uid)}`
const others = []
/** Another tab opening the same log; it claims the pen without telling anyone. */
const other_tab = async () => {
  const pi = await import(/* @vite-ignore */ '/pi-durable.browser.js')
  const storage = await pi.openIndexedDbStorage(DATABASE)
  others.push(storage)
  return storage
}
/** What the other tab says once it has opened. */
const announce = () => {
  const channel = new BroadcastChannel('realness-explorer')
  channel.postMessage({ claimed: DATABASE })
  channel.close()
}

const WAIT = { timeout: 10_000, interval: 50 }
const wait_for = expectation => vi.waitFor(expectation, WAIT)

const published = () =>
  views
    .filter(
      call => call.init?.method === 'POST' && call.url.endsWith('/v1/view')
    )
    .map(call => JSON.parse(call.init.body))

describe('chat with the real Durable browser bundle', () => {
  it('a writer that wrote offline becomes a branch, and /upstream reads the parent', async () => {
    const value = chat()
    replies.push({ content: 'First.' })
    await send(value, 'One.')
    await wait_for(() =>
      expect(
        published()
          .at(-1)
          ?.lines.map(line => line.text)
      ).toEqual(['One.', 'First.'])
    )
    views_offline = true
    replies.push({ content: 'Second, offline.' })
    await send(value, 'Two.')
    await wait_for(() =>
      expect(
        published()
          .at(-1)
          ?.lines.map(line => line.text)
      ).toContain('Second, offline.')
    )
    const before = views.length
    view_now = {
      type: 'view',
      writer: 'phone',
      tail: 40,
      lines: [
        { role: 'user', text: 'One.' },
        { role: 'assistant', text: 'First.' },
        { role: 'user', text: 'From the phone.' },
        { role: 'assistant', text: 'Phone reply.' }
      ]
    }
    views_offline = false
    await wait_for(() =>
      expect(
        views.slice(before).some(call => call.url.endsWith('/v1/view/claim'))
      ).toBe(true)
    )
    value.draft.value = '/upstream'
    await value.send()
    expect(value.status.value).toBe('Read 2 upstream lines')
    replies.push({ content: 'Caught up.' })
    await send(value, 'Three.')
    const last = requests
      .filter(request => request.url.endsWith('/chat/completions'))
      .at(-1)
    expect(JSON.stringify(last?.body.messages)).toContain('From the phone.')
    value.draft.value = '/upstream'
    await value.send()
    expect(value.status.value).toBe('Nothing upstream')
  })

  it('/upstream reads a separate conversation on another device', async () => {
    view_now = {
      type: 'view',
      writer: 'phone',
      tail: 9,
      lines: [
        { role: 'user', text: 'Phone question.' },
        { role: 'assistant', text: 'Phone answer.' }
      ]
    }
    const value = chat()
    replies.push({ content: 'Hello.' })
    await send(value, 'Mac question.')
    value.draft.value = '/upstream'
    await value.send()
    expect(value.status.value).toBe('Read 2 upstream lines')
    replies.push({ content: 'Seen it.' })
    await send(value, 'What did the phone ask?')
    const last = requests
      .filter(request => request.url.endsWith('/chat/completions'))
      .at(-1)
    expect(JSON.stringify(last?.body.messages)).toContain('Phone question.')
    value.draft.value = '/upstream'
    await value.send()
    expect(value.status.value).toBe('Nothing upstream')
  })

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

  it('goes read-only when another tab announces it took the chat, and takes it back', async () => {
    const value = chat()
    replies.push({ content: 'First tab.' })
    await send(value, 'Hello.')
    expect(value.taken.value).toBe(false)
    const other = await other_tab()
    announce()
    await wait_for(() => expect(value.taken.value).toBe(true))
    const spoken = requests.length
    value.draft.value = 'Still here?'
    await value.send()
    expect(requests).toHaveLength(spoken)
    expect(value.draft.value).toBe('Still here?')
    expect(value.status.value).toBe('')
    expect(value.messages.value.map(message => message.text)).toContain(
      'First tab.'
    )

    await other.close()
    await value.take_back()
    expect(value.taken.value).toBe(false)
    replies.push({ content: 'Back.' })
    await send(value, 'Again.')
    expect(value.messages.value.at(-1).text).toBe('Back.')
  })

  it('refuses a write after a silent takeover and keeps the draft', async () => {
    const value = chat()
    replies.push({ content: 'First tab.' })
    await send(value, 'Hello.')
    await other_tab()
    value.draft.value = 'Lost pen.'
    replies.push({ content: 'Should not land.' })
    await value.send()
    expect(value.taken.value).toBe(true)
    expect(value.draft.value).toBe('Lost pen.')
    expect(value.status.value).toBe('')
  })

  it('says a turn committed, and a read-only tab rereads the log itself', async () => {
    const heard = []
    const listener = new BroadcastChannel('realness-explorer')
    listener.onmessage = ({ data }) => {
      if (data.committed) heard.push(data)
    }
    const value = chat()
    replies.push({ content: 'Written here.' })
    await send(value, 'Hello.')
    await wait_for(() => expect(heard).toEqual([{ committed: DATABASE }]))

    const other = await other_tab()
    announce()
    await wait_for(() => expect(value.taken.value).toBe(true))
    const pi = await import(/* @vite-ignore */ '/pi-durable.browser.js')
    const user_id = await other.mintId()
    const reply_id = await other.mintId()
    await other.commit(
      [
        {
          type: 'entry',
          value: {
            id: user_id,
            conversationId: 1,
            kind: 'pi.user',
            model: [
              { role: 'user', content: 'From the other tab.', timestamp: 1 }
            ]
          }
        },
        {
          type: 'entry',
          value: {
            id: reply_id,
            conversationId: 1,
            kind: 'pi.assistant',
            model: [
              {
                role: 'assistant',
                content: [{ type: 'text', text: 'Read from disk.' }],
                timestamp: 2
              }
            ]
          }
        }
      ],
      pi.BACKGROUND_CONTEXT
    )
    listener.postMessage({ committed: DATABASE })
    await wait_for(() =>
      expect(value.messages.value.map(message => message.text)).toEqual([
        'Hello.',
        'Written here.',
        'From the other tab.',
        'Read from disk.'
      ])
    )
    listener.close()
  })

  it('shows the model reasoning beside the answer, live and after reopening', async () => {
    const value = chat()
    replies.push({ reasoning: 'Check the folder first.', ...bash_reply() })
    replies.push({
      reasoning: ' Then answer.',
      content: 'You are in /realness.'
    })
    await send(value, 'Where am I?')
    expect(value.messages.value.at(-1)).toMatchObject({
      text: 'You are in /realness.',
      thinking: 'Check the folder first. Then answer.'
    })
    await value.stop()
    await explorer.close()

    const reopened = chat()
    await reopened.watch()
    expect(reopened.messages.value).toEqual([
      { sender: 'You', text: 'Where am I?' },
      {
        sender: 'Realness',
        text: 'You are in /realness.',
        thinking: 'Check the folder first. Then answer.'
      }
    ])
  })
})
