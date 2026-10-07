import assert from 'node:assert/strict'
import { test } from 'node:test'
import { records } from '../stream.js'

test('reads split lines and split Unicode text without losing records', async () => {
  const bytes = new TextEncoder().encode(
    '{"type":"delta","text":"café"}\n{"type":"done"}\n'
  )
  const body = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
      controller.close()
    }
  })
  const received = []
  for await (const record of records(body)) received.push(record)
  assert.deepEqual(received, [
    { type: 'delta', text: 'café' },
    { type: 'done' }
  ])
})
