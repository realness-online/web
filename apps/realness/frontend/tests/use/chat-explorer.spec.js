import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'
import { use_chat } from '@/use/chat'
import { ask } from '@/utils/explorer'
import { send_chat } from '@/utils/chat'

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
