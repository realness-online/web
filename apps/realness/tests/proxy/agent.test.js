import assert from 'node:assert/strict'
import { test } from 'node:test'
import { call_upstream } from '../../src/proxy/agent.js'

test('the proxy chooses the model and keeps the other request fields', async () => {
  let sent
  await call_upstream(
    {
      model: 'client-choice',
      stream: true,
      messages: [{ role: 'user', content: 'hi' }]
    },
    {
      key: 'test-key',
      fetcher: async (url, options) => {
        sent = { url, options }
        return new Response(null, { status: 200 })
      }
    }
  )
  assert.equal(sent.url, 'https://openrouter.ai/api/v1/chat/completions')
  assert.equal(sent.options.headers.authorization, 'Bearer test-key')
  assert.equal(sent.options.headers['HTTP-Referer'], 'https://pi.dev')
  assert.equal(sent.options.headers['X-OpenRouter-Title'], 'pi')
  assert.deepEqual(JSON.parse(sent.options.body), {
    model: 'thinkingmachines/inkling:free',
    stream: true,
    messages: [{ role: 'user', content: 'hi' }],
    usage: { include: true }
  })
})
