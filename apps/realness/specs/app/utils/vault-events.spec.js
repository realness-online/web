/**
 * s1: an open view hears a vault write without polling.
 */
import { afterEach as after_each, expect, it, vi } from 'vite-plus/test'
import { read_events, watch_vault } from '@/utils/vault-events'

after_each(() => vi.unstubAllGlobals())

const stream_of = chunks => {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    }
  })
}

const change = path =>
  `<article itemscope itemtype="/change"><dl><dt>path</dt><dd><span itemprop="path">${path}</span></dd></dl></article>`

it('hands over each path an event names, across chunk boundaries', async () => {
  const seen = []
  await read_events(
    stream_of([
      ': open\n\n',
      `data: ${change('a.md')}\n`,
      `\ndata: ${change('b.md').slice(0, 40)}`,
      `${change('b.md').slice(40)}\n\n`
    ]),
    path => seen.push(path)
  )
  expect(seen).toEqual(['a.md', 'b.md'])
})

it('opens one stream with the reader token, and stops on request', async () => {
  const signals = []
  const fetch = vi.fn(async (url, options) => {
    signals.push(options.signal)
    return {
      ok: true,
      status: 200,
      body: stream_of([`data: ${change('a.md')}\n\n`])
    }
  })
  vi.stubGlobal('fetch', fetch)
  const seen = []
  const stop = await watch_vault(
    path => seen.push(path),
    async () => 'token'
  )
  expect(fetch).toHaveBeenCalledWith('/v1/vault/events', {
    headers: { authorization: 'Bearer token' },
    signal: expect.anything()
  })
  await vi.waitFor(() => expect(seen).toEqual(['a.md']))
  stop()
  expect(signals[0].aborted).toBe(true)
})

it('watches nothing when no one is signed in', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const stop = await watch_vault(
    () => {},
    async () => null
  )
  expect(fetch).not.toHaveBeenCalled()
  stop()
})
