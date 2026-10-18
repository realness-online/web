/** Build the browser provider against the same proxy contract as hosted Pi. */
export const explorer_provider = (pi, url, token) =>
  pi.createProvider({
    id: 'realness-proxy',
    name: 'Realness',
    baseUrl: url,
    auth: {
      apiKey: {
        name: 'Realness account',
        resolve: async () => ({
          auth: { apiKey: await token() },
          source: 'this browser'
        })
      }
    },
    api: pi.openAICompletionsApi(),
    models: [
      {
        id: 'inkling',
        name: 'Explorer',
        provider: 'realness-proxy',
        api: 'openai-completions',
        baseUrl: url,
        reasoning: false,
        input: ['text'],
        contextWindow: 1048576,
        maxTokens: 32768,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: { supportsDeveloperRole: false, supportsReasoningEffort: false }
      }
    ]
  })

/** Read assistant messages without treating user or tool text as a reply. */
export const assistant_text = ({ model = [] }) =>
  model
    .filter(message => message.role === 'assistant')
    .flatMap(message => message.content ?? [])
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
