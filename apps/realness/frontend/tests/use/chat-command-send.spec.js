import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { ref } from 'vue'
import { use_chat } from '@/use/chat'
import { run_chat_command, send_chat } from '@/utils/brayness-chat'

vi.mock('@/utils/serverless', () => ({ current_user: { value: null } }))
vi.mock('@/utils/brayness-chat', () => ({
  watch_chat: vi.fn(async () => []),
  send_chat: vi.fn(async () => 'done'),
  run_chat_command: vi.fn(),
  chat_warning: vi.fn(async () => null),
  readable_error: text => text
}))

beforeEach(() => vi.clearAllMocks())

const chat_with = draft => {
  const chat = use_chat(ref('actor-1'))
  chat.draft.value = draft
  return chat
}

describe('chat commands from the input', () => {
  it('runs a command instead of sending it to the model', async () => {
    run_chat_command.mockResolvedValue({
      type: 'done',
      text: 'Thinking: high',
      level: 'high'
    })
    const chat = chat_with('/thinking high')
    await chat.send()
    expect(run_chat_command).toHaveBeenCalledWith(
      null,
      'actor-1',
      'thinking',
      'high'
    )
    expect(send_chat).not.toHaveBeenCalled()
    expect(chat.status.value).toBe('Thinking: high')
    expect(chat.draft.value).toBe('')
  })

  it('lists models when /model has no name', async () => {
    run_chat_command.mockResolvedValue({
      type: 'done',
      text: 'Model: brayness/fast',
      model: 'brayness/fast',
      models: ['brayness/fast', 'brayness/deep']
    })
    const chat = chat_with('/model')
    await chat.send()
    expect(chat.status.value).toBe(
      'Model: brayness/fast. Available: brayness/fast, brayness/deep'
    )
  })

  it('clears the conversation after /new', async () => {
    run_chat_command.mockResolvedValue({ type: 'done', text: 'New session' })
    const chat = chat_with('/new')
    chat.messages.value = [{ sender: 'You', text: 'old' }]
    await chat.send()
    expect(chat.messages.value).toEqual([])
  })

  it('keeps the draft and shows the error when a command fails', async () => {
    run_chat_command.mockRejectedValue(new Error('Stop Pi first'))
    const chat = chat_with('/compact')
    await chat.send()
    expect(chat.status.value).toBe('Stop Pi first')
    expect(chat.draft.value).toBe('/compact')
  })

  it('names the known commands for an unknown one, and never sends it', async () => {
    const chat = chat_with('/login')
    await chat.send()
    expect(run_chat_command).not.toHaveBeenCalled()
    expect(send_chat).not.toHaveBeenCalled()
    expect(chat.status.value).toBe(
      'Unknown command /login. Try /stop, /new, /compact, /model, /thinking, /copy'
    )
    expect(chat.draft.value).toBe('/login')
  })

  it('copies the last reply in the browser', async () => {
    const write_text = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: write_text },
      configurable: true
    })
    const chat = chat_with('/copy')
    chat.messages.value = [
      { sender: 'Brayness', text: 'first' },
      { sender: 'You', text: 'more' },
      { sender: 'Brayness', text: 'last reply' }
    ]
    await chat.send()
    expect(write_text).toHaveBeenCalledWith('last reply')
    expect(run_chat_command).not.toHaveBeenCalled()
    expect(chat.status.value).toBe('Copied')
  })

  it('says a message sent while Pi works is queued', async () => {
    send_chat.mockResolvedValue('queued')
    const chat = chat_with('and then this')
    await chat.send()
    expect(chat.status.value).toBe('Queued for after this turn')
  })
})
