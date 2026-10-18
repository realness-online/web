import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'
import { use_chat } from '@/use/chat'
import { ask, give_log } from '@/utils/explorer'
import { send_chat, watch_chat } from '@/utils/chat'

vi.mock('@/utils/serverless', () => ({
  current_user: { value: { uid: 'person-1', getIdToken: async () => 'bearer' } }
}))
vi.mock('@/utils/explorer', () => ({ ask: vi.fn(), give_log: vi.fn() }))
vi.mock('@/utils/chat', () => ({
  watch_chat: vi.fn(async () => []),
  send_chat: vi.fn(),
  chat_warning: vi.fn(async () => null),
  readable_error: text => text
}))

afterEach(() => vi.clearAllMocks())

describe('browser chat during actor startup', () => {
  it('loads the browser conversation before asking terminal Pi to continue', async () => {
    const log = { handover_id: 'handover-1', entries: [] }
    ask.mockResolvedValueOnce({ hand_over: log })
    give_log.mockResolvedValueOnce({ resumed: true, handover_id: 'handover-1' })
    watch_chat.mockResolvedValueOnce([
      {
        type: 'history',
        messages: [
          { role: 'user', text: 'Run pwd' },
          { role: 'assistant', text: '/realness' }
        ]
      }
    ])
    const chat = use_chat(ref('ready-actor'))
    chat.draft.value = 'Run pwd'
    await chat.send()
    expect(give_log).toHaveBeenCalledWith(expect.anything(), 'ready-actor', log)
    expect(send_chat).toHaveBeenCalledWith(
      expect.anything(),
      'ready-actor',
      'Continue the last request using the terminal tools.'
    )
    expect(give_log.mock.invocationCallOrder.at(-1)).toBeLessThan(
      send_chat.mock.invocationCallOrder.at(-1)
    )
    expect(chat.messages.value.map(message => message.text)).toEqual([
      'Run pwd',
      '/realness'
    ])
    chat.stop()
  })

  it('retries a pending transfer without opening another browser session', async () => {
    const log = { handover_id: 'handover-2', entries: [] }
    ask.mockResolvedValueOnce({ hand_over: log })
    give_log
      .mockRejectedValueOnce(new Error('Pi unavailable'))
      .mockRejectedValueOnce(new Error('Still unavailable'))
    const chat = use_chat(ref('ready-actor'))
    chat.draft.value = 'Run pwd'
    await chat.send()
    expect(chat.status.value).toBe('Pi unavailable')
    await chat.send()
    expect(chat.status.value).toBe('Still unavailable')
    expect(ask).toHaveBeenCalledTimes(1)
    expect(send_chat).not.toHaveBeenCalled()
    chat.stop()
  })

  it('keeps browser ownership and history when the terminal actor becomes available', async () => {
    ask.mockResolvedValueOnce({ text: 'I remember the plan' })
    ask.mockResolvedValueOnce({ text: 'Still the same conversation' })
    const actor = ref(null)
    const chat = use_chat(actor)
    chat.draft.value = 'Remember our plan'
    await chat.send()
    actor.value = 'ready-actor'
    watch_chat.mockResolvedValueOnce([{ type: 'history', messages: [] }])
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
    chat.stop()
  })

  it('answers through Explorer when an actor is assigned but its bridge is not ready', async () => {
    ask.mockImplementationOnce(async ({ on_delta }) => {
      on_delta('Hello')
      return { text: 'Hello' }
    })
    const chat = use_chat(ref('booting-actor'))
    chat.draft.value = 'how is it going'
    await chat.send()
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'how is it going',
        user_id: 'person-1'
      })
    )
    expect(chat.messages.value).toEqual([
      { sender: 'You', text: 'how is it going' },
      { sender: 'Realness', text: 'Hello' }
    ])
    expect(send_chat).not.toHaveBeenCalled()
    expect(chat.waiting.value).toBe(false)
    expect(chat.working.value).toBe(false)
    expect(chat.draft.value).toBe('')
    chat.stop()
  })
})
