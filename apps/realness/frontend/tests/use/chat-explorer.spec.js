import {
  afterEach as after_each,
  describe,
  expect,
  it,
  vi
} from 'vite-plus/test'
import { ref } from 'vue'
import { use_chat } from '@/use/chat'
import { ask, history, stop, command } from '@/utils/explorer'
import { send_chat, watch_chat } from '@/utils/chat'

vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'person-1', getIdToken: async () => 'bearer' } }
}))
vi.mock('@/utils/explorer', () => ({
  ask: vi.fn(),
  history: vi.fn(async () => []),
  stop: vi.fn(async () => {}),
  command: vi.fn()
}))
vi.mock('@/utils/chat', () => ({
  watch_chat: vi.fn(async () => []),
  send_chat: vi.fn(),
  chat_warning: vi.fn(async () => null),
  readable_error: text => text
}))

after_each(() => vi.clearAllMocks())

describe('browser chat during actor startup', () => {
  it('keeps browser ownership and history when the terminal actor becomes available', async () => {
    ask.mockResolvedValueOnce({ text: 'I remember the plan' })
    ask.mockResolvedValueOnce({ text: 'Still the same conversation' })
    const actor = ref(null)
    const chat = use_chat(actor)
    chat.draft.value = 'Remember our plan'
    await chat.send()
    actor.value = 'ready-actor'
    history.mockResolvedValueOnce([
      { role: 'user', text: 'Remember our plan' },
      { role: 'assistant', text: 'I remember the plan' }
    ])
    await chat.watch()
    chat.draft.value = 'Where are we?'
    await chat.send()
    expect(ask).toHaveBeenCalledTimes(2)
    expect(watch_chat).not.toHaveBeenCalled()
    expect(send_chat).not.toHaveBeenCalled()
    expect(chat.messages.value.map(message => message.text)).toEqual([
      'Remember our plan',
      'I remember the plan',
      'Where are we?',
      'Still the same conversation'
    ])
    await chat.stop()
  })

  it('answers through Explorer when an actor is assigned but its bridge is not ready', async () => {
    ask.mockImplementationOnce(async ({ on_delta }) => {
      on_delta('Hello')
      return { text: 'Hello' }
    })
    const changed = vi.fn()
    const chat = use_chat(ref('booting-actor'), { on_change: changed })
    chat.draft.value = 'how is it going'
    await chat.send()
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'how is it going', user_id: 'person-1' })
    )
    expect(chat.messages.value).toEqual([
      { sender: 'You', text: 'how is it going' },
      { sender: 'Realness', text: 'Hello' }
    ])
    expect(send_chat).not.toHaveBeenCalled()
    expect(changed).toHaveBeenCalled()
    expect(chat.waiting.value).toBe(false)
    expect(chat.working.value).toBe(false)
    expect(chat.draft.value).toBe('')
    await chat.stop()
    expect(stop).toHaveBeenCalled()
  })

  it('runs chat commands against Durable instead of terminal Pi', async () => {
    command.mockResolvedValueOnce({ text: 'New session' })
    const chat = use_chat(ref('terminal-actor'))
    chat.messages.value = [{ sender: 'You', text: 'previous' }]
    chat.draft.value = '/new'
    await chat.send()
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'new', user_id: 'person-1' })
    )
    expect(chat.messages.value).toEqual([])
    expect(send_chat).not.toHaveBeenCalled()
    expect(watch_chat).not.toHaveBeenCalled()
    await chat.stop()
  })

  it('shows a failed browser operation and retains the conversation', async () => {
    ask.mockRejectedValueOnce(new Error('VM unavailable'))
    ask.mockResolvedValueOnce({ text: 'We can still talk' })
    const chat = use_chat(ref('terminal-actor'))
    chat.draft.value = 'Run pwd'
    await chat.send()
    expect(chat.status.value).toBe('VM unavailable')
    expect(chat.messages.value[0].text).toBe('Run pwd')
    chat.draft.value = 'Can we still talk?'
    await chat.send()
    expect(ask).toHaveBeenCalledTimes(2)
    expect(send_chat).not.toHaveBeenCalled()
    expect(chat.messages.value.at(-1).text).toBe('We can still talk')
    await chat.stop()
  })
})
