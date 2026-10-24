import { describe, expect, it } from 'vitest'
import {
  assistant_text,
  assistant_failure,
  explorer_provider
} from '../../../src/app/utils/explorer-provider.js'

describe('Explorer provider', () => {
  it('reports provider errors from committed assistant records', () => {
    const entries = [
      {
        model: [
          {
            role: 'assistant',
            stopReason: 'error',
            errorMessage: 'Connection error.'
          }
        ]
      }
    ]
    expect(assistant_failure(entries)).toBe('Connection error.')
    entries.push({ model: [{ role: 'assistant', stopReason: 'stop' }] })
    expect(assistant_failure(entries)).toBeNull()
  })

  it('uses the proxy model and provider-level completions API', async () => {
    const api = { stream: () => {} }
    const pi = {
      createProvider: input => input,
      openAICompletionsApi: () => api
    }
    let bearer = 'first'
    const provider = explorer_provider(
      pi,
      'https://proxy.example',
      async () => bearer
    )
    expect(provider.api).toBe(api)
    expect(provider.baseUrl).toBe('https://proxy.example')
    expect(provider.models[0]).toMatchObject({
      id: 'inkling',
      api: 'openai-completions',
      provider: provider.id,
      baseUrl: provider.baseUrl
    })
    expect((await provider.auth.apiKey.resolve()).auth.apiKey).toBe('first')
    bearer = 'refreshed'
    expect((await provider.auth.apiKey.resolve()).auth.apiKey).toBe('refreshed')
  })

  it('reads assistant content from committed message records', () => {
    expect(
      assistant_text({
        model: [
          { role: 'user', content: [{ type: 'text', text: 'question' }] },
          {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'private' },
              { type: 'text', text: 'answer' },
              { type: 'text', text: ' continues' }
            ]
          },
          { role: 'toolResult', content: [{ type: 'text', text: 'tool' }] }
        ]
      })
    ).toBe('answer continues')
  })
})
