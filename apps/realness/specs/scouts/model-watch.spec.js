import assert from 'node:assert/strict'
import { it } from 'node:test'
import { model_watch } from '#root/src/scouts/model-watch.js'

const start = { type: 'message_start', message: { role: 'assistant' } }
const delta = text => ({
  type: 'message_update',
  message: { role: 'assistant' },
  assistantMessageEvent: { type: 'thinking_delta', delta: text }
})

it('a model call says asked, first byte, streaming, and done', () => {
  let clock = 0
  const said = []
  const watch = model_watch({ say: line => said.push(line), now: () => clock })
  watch.event(start)
  clock = 2000
  watch.event(delta('hello'))
  clock = 16_000
  watch.event(delta(' world'))
  watch.tick()
  clock = 17_000
  watch.event({
    type: 'message_end',
    message: { role: 'assistant', stopReason: 'stop' }
  })
  assert.deepEqual(said, [
    'model  asked',
    'model  first byte after 2s',
    'model  streaming, 11 chars',
    'model  done, 11 chars in 17s'
  ])
})

it('a quiet model call is said while it is quiet, and the hop error word for word', () => {
  let clock = 0
  const said = []
  const watch = model_watch({ say: line => said.push(line), now: () => clock })
  watch.event(start)
  clock = 1000
  watch.event(delta('x'))
  clock = 21_000
  watch.tick()
  clock = 41_000
  watch.tick()
  watch.event({
    type: 'message_end',
    message: {
      role: 'assistant',
      stopReason: 'error',
      errorMessage: 'Upstream idle timeout exceeded'
    }
  })
  assert.deepEqual(said.slice(2), [
    'model  no bytes for 20s',
    'model  no bytes for 40s',
    'model  ended after 41s: Upstream idle timeout exceeded'
  ])
})
