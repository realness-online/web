import { describe, expect, it, vi } from 'vite-plus/test'
import { compare_tails, upstream_note, watch_view } from '@/utils/explorer-view'

const self = (local_moved, seen = { writer: 'tab', tail: 5 }) => ({
  writer: 'tab',
  seen,
  local_moved
})
const view = (writer, tail) => ({ writer, tail, lines: [] })

describe('compare tails', () => {
  it('continues when nobody else wrote', () => {
    expect(compare_tails(self(true), view(null, 0))).toBe('continue')
    expect(compare_tails(self(true), view('tab', 5))).toBe('continue')
    expect(
      compare_tails(self(true, { writer: 'phone', tail: 9 }), view('phone', 9))
    ).toBe('continue')
  })

  it('hands over the pen when only the other device moved', () => {
    expect(compare_tails(self(false), view('phone', 9))).toBe('yield')
  })

  it('takes the pen when the tab is fresh', () => {
    expect(
      compare_tails(self(false, { writer: null, tail: 0 }), view('closed', 9))
    ).toBe('continue')
  })

  it('branches when both moved', () => {
    expect(compare_tails(self(true), view('phone', 9))).toBe('branch')
  })

  it('writes the other device lines as one note', () => {
    expect(
      upstream_note([
        { role: 'user', text: 'hi' },
        { role: 'assistant', text: 'hello' }
      ])
    ).toBe(
      'From the conversation on another device:\nuser: hi\nassistant: hello'
    )
  })
})

const opened = []
vi.mock('@/utils/gate', () => ({
  gate_fetch: (user, path, init) => {
    opened.push(init.signal)
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"view"}\n'))
        init.signal.addEventListener('abort', () =>
          controller.error(new DOMException('aborted', 'AbortError'))
        )
      }
    })
    return Promise.resolve({ body })
  }
}))

const show = visible => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => !visible
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('watch view', () => {
  it('closes the gate stream while the page is hidden', async () => {
    const stop = new AbortController()
    const seen = []
    const watching = watch_view(async () => 'token', {
      on_open: record => seen.push(record),
      on_record: () => {},
      signal: stop.signal
    })
    await vi.waitFor(() => expect(seen).toHaveLength(1))
    show(false)
    expect(opened[0].aborted).toBe(true)
    await new Promise(done => setTimeout(done, 10))
    expect(opened).toHaveLength(1)
    show(true)
    await vi.waitFor(() => expect(seen).toHaveLength(2))
    stop.abort()
    await watching
    expect(opened.every(signal => signal.aborted)).toBe(true)
  })

  it('closes the gate stream while the page is idle', async () => {
    const stop = new AbortController()
    const seen = []
    const start = opened.length
    const watching = watch_view(async () => 'token', {
      on_open: record => seen.push(record),
      on_record: () => {},
      signal: stop.signal,
      idle_ms: 20
    })
    await vi.waitFor(() => expect(seen).toHaveLength(1))
    await vi.waitFor(() => expect(opened[start].aborted).toBe(true))
    await new Promise(done => setTimeout(done, 30))
    expect(opened).toHaveLength(start + 1)
    document.dispatchEvent(new KeyboardEvent('keydown'))
    await vi.waitFor(() => expect(seen).toHaveLength(2))
    stop.abort()
    await watching
  })
})
