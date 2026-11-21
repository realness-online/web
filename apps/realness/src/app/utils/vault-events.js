/**
 * s1: an open view hears a vault write through sync's event stream, and no
 * polling runs when nothing changes.
 */

import { read_change } from '@/utils/vault-items'

/* eslint-disable no-await-in-loop -- a stream is read one chunk at a time */

/**
 * Read a stream of `data: <article itemtype="/change">` events and hand each path over.
 * @param {ReadableStream<Uint8Array>} stream
 * @param {(path: string) => void} on_path
 * @returns {Promise<void>} resolves when the stream ends
 */
export const read_events = async (stream, on_path) => {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const cut = buffer.lastIndexOf('\n\n')
    if (cut < 0) continue
    const chunk = buffer.slice(0, cut)
    buffer = buffer.slice(cut + 2)
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const path = read_change(line.slice('data: '.length))
      if (typeof path === 'string') on_path(path)
    }
  }
}

/**
 * Watch the vault for writes. Resolves to a stop function; calling it closes
 * the stream. A signed-out reader gets a stop function that does nothing.
 * @param {(path: string) => void} on_path
 * @param {() => Promise<string | null>} token_for the reader's token
 * @param {typeof fetch} [fetcher]
 * @returns {Promise<() => void>}
 */
export const watch_vault = async (on_path, token_for, fetcher = fetch) => {
  const token = await token_for()
  if (!token) return () => {}
  const control = new AbortController()
  fetcher('/v1/vault/events', {
    headers: { authorization: `Bearer ${token}` },
    signal: control.signal
  })
    .then(async response => {
      if (!response.ok || !response.body) return
      await read_events(response.body, on_path)
    })
    .catch(() => {})
  return () => control.abort()
}
