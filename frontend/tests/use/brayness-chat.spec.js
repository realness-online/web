import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'
import { use_chat } from '@/use/chat'
import { watch_chat } from '@/utils/brayness-chat'

vi.mock('@/utils/serverless', () => ({ current_user: { value: null } }))
vi.mock('@/utils/brayness-chat', () => ({
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
      { sender: 'Brayness', text: 'Answer' }
    ])
    chat.stop()
    expect(watch_chat.mock.calls[0][2].signal.aborted).toBe(true)
  })
})
