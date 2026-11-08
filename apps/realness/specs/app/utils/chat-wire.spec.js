import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { records } from '@/utils/stream-records'
import { gate_api, gate_fetch } from '@/utils/gate'
import {
  chat_warning,
  readable_error,
  run_chat_command,
  send_chat,
  watch_chat
} from '@/utils/chat'

vi.mock('@/utils/gate', () => ({
  gate_api: vi.fn(),
  gate_fetch: vi.fn()
}))

vi.mock('@/utils/stream-records', () => ({
  records: vi.fn()
}))

const user = { id: 1 }
const as_records = list =>
  async function* () {
    yield* list
  }

beforeEach(() => {
  vi.mocked(gate_api).mockReset()
  vi.mocked(gate_fetch).mockReset()
  vi.mocked(records).mockReset()
})

describe('chat wire', () => {
  it('reads the history first, then every turn, and passes the abort on', async () => {
    vi.mocked(gate_fetch).mockResolvedValue({ body: 'body' })
    vi.mocked(records).mockReturnValue(as_records([{ type: 'turn' }])())
    const signal = new AbortController().signal
    const seen = []
    for await (const record of await watch_chat(user, '+1 415 555 1234', {
      signal
    }))
      seen.push(record)
    expect(gate_fetch).toHaveBeenCalledWith(
      user,
      '/v1/actors/%2B1%20415%20555%201234/chat/events',
      { signal }
    )
    expect(seen).toEqual([{ type: 'turn' }])
  })

  it('sends a message and calls the turn done when it ends', async () => {
    vi.mocked(gate_fetch).mockResolvedValue({ body: 'body' })
    vi.mocked(records).mockReturnValue(
      as_records([{ type: 'text', text: 'hi' }])()
    )
    expect(await send_chat(user, 'a', 'hello')).toBe('done')
    expect(JSON.parse(vi.mocked(gate_fetch).mock.calls[0][2].body)).toEqual({
      message: 'hello'
    })
  })

  it('calls a message queued when Pi was already working', async () => {
    vi.mocked(gate_fetch).mockResolvedValue({ body: 'body' })
    vi.mocked(records).mockReturnValue(
      as_records([{ type: 'queued' }, { type: 'done' }])()
    )
    expect(await send_chat(user, 'a', 'hello')).toBe('queued')
  })

  it('throws the text of a turn error', async () => {
    vi.mocked(gate_fetch).mockResolvedValue({ body: 'body' })
    vi.mocked(records).mockReturnValue(
      as_records([{ type: 'error', text: 'no model key' }])()
    )
    await expect(send_chat(user, 'a', 'hello')).rejects.toThrow('no model key')
  })

  it('keeps the last reply record of a command, and throws its errors', async () => {
    vi.mocked(gate_fetch).mockResolvedValue({ body: 'body' })
    vi.mocked(records).mockReturnValue(
      as_records([
        { type: 'text', text: 'one' },
        { type: 'text', text: 'two' }
      ])()
    )
    expect(await run_chat_command(user, 'a', 'compact', '--now')).toEqual({
      type: 'text',
      text: 'two'
    })
    expect(JSON.parse(vi.mocked(gate_fetch).mock.calls[0][2].body)).toEqual({
      command: 'compact',
      args: '--now'
    })

    vi.mocked(records).mockReturnValue(
      as_records([{ type: 'error', text: 'unknown command' }])()
    )
    await expect(run_chat_command(user, 'a', 'nope')).rejects.toThrow(
      'unknown command'
    )
  })

  it('returns the proxy warning, or nothing when there is none', async () => {
    vi.mocked(gate_api).mockResolvedValue({ warn: { message: 'near' } })
    expect(await chat_warning(user, 'a')).toEqual({ message: 'near' })
    vi.mocked(gate_api).mockResolvedValue({ warn: null })
    expect(await chat_warning(user, 'a')).toBeNull()
    vi.mocked(gate_api).mockResolvedValue({})
    expect(await chat_warning(user, 'a')).toBeNull()
    vi.mocked(gate_api).mockRejectedValue(new Error('offline'))
    expect(await chat_warning(user, 'a')).toBeNull()
  })

  it('reads a gate error body as its message', () => {
    expect(readable_error('400: {"message":"bad model"}')).toBe('bad model')
    expect(readable_error('plain text')).toBe('plain text')
    expect(
      readable_error('429: {"message":"slow down: quota exceeded."}')
    ).toBe('slow down.')
    expect(readable_error('500: not json')).toBe('500: not json')
  })
})
