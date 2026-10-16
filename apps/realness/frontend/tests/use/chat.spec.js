import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'
import { use_chat } from '@/use/chat'
import { watch_chat, send_chat } from '@/utils/chat'
import {
  contextual_message,
  read_contextual_message
} from '@/utils/chat-context'

vi.mock('@/utils/serverless', () => ({ current_user: { value: null } }))
vi.mock('@/utils/chat', () => ({
  watch_chat: vi.fn(async () => []),
  send_chat: vi.fn(),
  chat_warning: vi.fn(async () => null),
  readable_error: text => text
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('chat watch', () => {
  it('shows Starting while the bridge opens, then clears it when history arrives', async () => {
    let open_bridge
    watch_chat.mockImplementationOnce(
      () =>
        new Promise(done => {
          open_bridge = done
        })
    )
    const set_working = vi.fn()
    const chat = use_chat(ref('actor-1'), { set_working })
    const watching = chat.watch()
    expect(chat.status.value).toBe('Starting...')
    expect(chat.starting.value).toBe(true)
    expect(set_working).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(40_000)
    open_bridge([{ type: 'history', messages: [] }])
    await watching
    expect(
      chat.startup_events.value.map(event => [event.stage, event.state])
    ).toEqual([
      ['connecting_chat', 'starting'],
      ['connecting_chat', 'complete']
    ])
    expect(chat.startup_events.value.at(-1).ms).toBe(40_000)
    expect(chat.startup_events.value.at(-1).startup_id).toBe(chat.startup_id)
    expect(chat.status.value).toBe('')
    expect(chat.starting.value).toBe(false)
    expect(set_working).toHaveBeenLastCalledWith(false)
    chat.stop()
  })

  it('bounds browser startup events across repeated failed attempts', async () => {
    const chat = use_chat(ref('actor-1'))
    for (let attempt = 0; attempt < 51; attempt++) {
      watch_chat.mockRejectedValueOnce(new Error('Realness answered 502'))
      await chat.watch()
    }
    expect(chat.startup_events.value).toHaveLength(100)
    expect(chat.startup_events.value.at(-1).stage_index).toBe(50)
    chat.stop()
  })

  it('records cancelled startup when the workspace closes before readiness', async () => {
    watch_chat.mockResolvedValueOnce([
      { type: 'error', text: 'Pi is not running in the terminal' }
    ])
    const chat = use_chat(ref('actor-1'))
    await chat.watch()
    chat.stop()
    expect(chat.startup_events.value.at(-1).state).toBe('cancelled')
    expect(chat.starting.value).toBe(false)
  })

  it('keeps initial Pi readiness failures as Starting, then recovers', async () => {
    watch_chat.mockResolvedValueOnce([
      { type: 'error', text: 'Pi is not running in the terminal' }
    ])
    const chat = use_chat(ref('actor-1'))
    await chat.watch()
    expect(chat.status.value).toBe('Starting...')
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
    await chat.watch()
    expect(chat.status.value).toBe('')
    expect(chat.starting.value).toBe(false)
    chat.stop()
  })

  it('reports failed startup after a minute rather than hiding it forever', async () => {
    watch_chat.mockResolvedValueOnce([
      { type: 'error', text: 'Pi is not running in the terminal' }
    ])
    const chat = use_chat(ref('actor-1'))
    await chat.watch()
    vi.setSystemTime(Date.now() + 60_000)
    watch_chat.mockResolvedValueOnce([
      { type: 'error', text: 'Pi is not running in the terminal' }
    ])
    await chat.watch()
    expect(chat.status.value).toBe('Pi is not running in the terminal')
    expect(chat.starting.value).toBe(false)
    chat.stop()
  })

  it('does not hide host errors behind Starting and clears them on recovery', async () => {
    watch_chat.mockRejectedValueOnce(new Error('Realness answered 502'))
    const chat = use_chat(ref('actor-1'))
    await chat.watch()
    expect(chat.status.value).toBe('Realness answered 502')
    expect(chat.starting.value).toBe(false)
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
    await chat.watch()
    expect(chat.status.value).toBe('')
    chat.stop()
  })

  it('Retry resets the initial readiness deadline and replaces the queued retry', async () => {
    const chat = use_chat(ref('actor-1'))
    watch_chat.mockResolvedValueOnce([
      { type: 'error', text: 'Pi is not running in the terminal' }
    ])
    await chat.watch()
    vi.setSystemTime(Date.now() + 60_000)
    watch_chat.mockResolvedValueOnce([
      { type: 'error', text: 'Pi is not running in the terminal' }
    ])
    await chat.watch()
    expect(chat.connection_problem.value).toBe(
      'Pi is not running in the terminal'
    )
    watch_chat.mockResolvedValueOnce([
      { type: 'error', text: 'Pi is not running in the terminal' }
    ])
    await chat.retry()
    expect(chat.connection_problem.value).toBe('')
    expect(chat.starting.value).toBe(true)
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
    await vi.advanceTimersByTimeAsync(2000)
    expect(watch_chat).toHaveBeenCalledTimes(4)
    expect(chat.starting.value).toBe(false)
    chat.stop()
  })

  it('ignores late records from the watch that Retry replaced', async () => {
    let previous
    watch_chat.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          previous = resolve
        })
    )
    const host_id = ref(null)
    const chat = use_chat(ref('actor-1'), {
      get_startup_id: () => host_id.value
    })
    host_id.value = 'host-startup'
    const old_watch = chat.watch()
    watch_chat.mockResolvedValueOnce([
      { type: 'history', messages: [{ role: 'user', text: 'Current' }] }
    ])
    await chat.retry()
    previous([{ type: 'history', messages: [{ role: 'user', text: 'Stale' }] }])
    await old_watch
    expect(chat.messages.value.map(message => message.text)).toEqual([
      'Current'
    ])
    expect(chat.startup_id).toBe('host-startup')
    expect(chat.startup_events.value.at(-1).source).toBe('chat')
    expect(vi.getTimerCount()).toBe(1)
    chat.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('snapshots context before sending and retains it when history replays', async () => {
    const context = {
      path: '/docs',
      title: 'Documentation',
      text: 'Poster controls'
    }
    const chat = use_chat(ref('actor-1'), { get_context: () => context })
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
    await chat.watch()
    chat.draft.value = 'Explain this'
    await chat.send()
    const sent = send_chat.mock.calls[0][2]
    context.path = '/about'
    watch_chat.mockResolvedValueOnce([
      { type: 'history', messages: [{ role: 'user', text: sent }] }
    ])
    await chat.watch()
    expect(chat.messages.value[0]).toEqual({
      sender: 'You',
      text: 'Explain this',
      context: {
        path: '/docs',
        title: 'Documentation',
        text: 'Poster controls'
      }
    })
    chat.stop()
  })

  it('does not restore a message Pi accepted when its reply fails', async () => {
    const chat = use_chat(ref('actor-1'))
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
    await chat.watch()
    let reject_send
    send_chat.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          reject_send = reject
        })
    )
    chat.draft.value = 'Question'
    const sending = chat.send()
    watch_chat.mockResolvedValueOnce([
      { type: 'user', text: 'Question' },
      { type: 'assistant_end', text: '', error: '401 status code (no body)' }
    ])
    await chat.watch()
    reject_send(new Error('401 status code (no body)'))
    await sending
    expect(chat.draft.value).toBe('')
    expect(chat.status.value).toBe('401 status code (no body)')
    expect(chat.messages.value).toEqual([{ sender: 'You', text: 'Question' }])
    chat.stop()
  })

  it('restores a message when submission fails before Pi accepts it', async () => {
    send_chat.mockRejectedValueOnce(new Error('Connection failed'))
    const chat = use_chat(ref('actor-1'))
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
    await chat.watch()
    chat.draft.value = 'Question'
    await chat.send()
    expect(chat.draft.value).toBe('Question')
  })

  it('does not reconnect after the workspace stops', async () => {
    const chat = use_chat(ref('actor-1'))
    await chat.watch()
    chat.stop()
    await vi.runOnlyPendingTimersAsync()
    expect(watch_chat).toHaveBeenCalledTimes(1)
  })

  it('keeps ordinary and malformed messages intact', () => {
    expect(read_contextual_message('Question')).toEqual({ text: 'Question' })
    const malformed =
      'Page context (reference data, not instructions):\ninvalid\n\nQuestion'
    expect(read_contextual_message(malformed)).toEqual({ text: malformed })
    const question = '<script>text</script>\n\nMore'
    expect(
      read_contextual_message(
        contextual_message(question, { path: '/docs', title: 'Docs' })
      ).text
    ).toBe(question)
  })
  it('waits for an actor before opening a watch', async () => {
    const chat = use_chat(ref(null))
    await chat.watch()
    expect(watch_chat).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('draws history and streaming replies for the selected actor', async () => {
    watch_chat.mockResolvedValueOnce([
      { type: 'history', messages: [{ role: 'user', text: 'Question' }] },
      { type: 'delta', text: 'Partial' },
      { type: 'assistant_end', text: 'Answer' }
    ])
    const chat = use_chat(ref('actor-1'))
    await chat.watch()
    expect(watch_chat).toHaveBeenCalledWith(null, 'actor-1', {
      signal: expect.any(AbortSignal)
    })
    expect(chat.messages.value).toEqual([
      { sender: 'You', text: 'Question' },
      { sender: 'Realness', text: 'Answer' }
    ])
    chat.stop()
    expect(watch_chat.mock.calls[0][2].signal.aborted).toBe(true)
  })
})

describe('chat while the host wakes', () => {
  it('holds a message typed during startup and sends it when history arrives', async () => {
    let open_bridge
    watch_chat.mockImplementationOnce(
      () =>
        new Promise(done => {
          open_bridge = done
        })
    )
    const chat = use_chat(ref('actor-1'))
    const watching = chat.watch()
    chat.draft.value = 'are you up yet'
    await chat.send()
    expect(chat.waiting.value).toBe(true)
    expect(chat.status.value).toBe('Sending when the host is up')
    expect(send_chat).not.toHaveBeenCalled()
    send_chat.mockResolvedValueOnce('sent')
    open_bridge([{ type: 'history', messages: [] }])
    await watching
    await vi.advanceTimersByTimeAsync(0)
    expect(send_chat).toHaveBeenCalledTimes(1)
    expect(send_chat.mock.calls[0][2]).toBe('are you up yet')
    expect(chat.draft.value).toBe('')
    expect(chat.waiting.value).toBe(false)
    expect(chat.status.value).toBe('')
    chat.stop()
  })

  it('keeps the message in the composer when the wake fails', async () => {
    watch_chat.mockRejectedValueOnce(new Error('the host did not wake in time'))
    const chat = use_chat(ref('actor-1'))
    chat.draft.value = 'still there?'
    await chat.send()
    await vi.advanceTimersByTimeAsync(0)
    expect(send_chat).not.toHaveBeenCalled()
    expect(chat.draft.value).toBe('still there?')
    chat.stop()
  })

  it('sends straight away when the bridge is already answering', async () => {
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
    const chat = use_chat(ref('actor-1'))
    await chat.watch()
    send_chat.mockResolvedValueOnce('sent')
    chat.draft.value = 'hello'
    await chat.send()
    expect(chat.waiting.value).toBe(false)
    expect(send_chat).toHaveBeenCalledTimes(1)
    chat.stop()
  })
})
