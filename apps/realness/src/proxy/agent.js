import { MIB } from '#root/lib/units.js'

const LIMIT_MIB = 10
const UPSTREAM = 'https://openrouter.ai/api/v1/chat/completions'
export const MODEL = 'thinkingmachines/inkling:free'
export const HOUSE_MODEL =
  process.env.HOUSE_MODEL ?? 'deepseek/deepseek-v4-flash'
const TIMEOUT_MS = 120_000
const LIMIT = LIMIT_MIB * MIB

/**
 * Ask the upstream model provider, streaming the answer back.
 * @param {Record<string, unknown>} body
 * @param {object} [options]
 * @param {string} [options.key] the provider key; the header reads undefined without one
 * @param {typeof fetch} [options.fetcher]
 * @param {string} [options.model]
 */
export const call_upstream = (
  body,
  { key, fetcher = fetch, model = MODEL } = {}
) =>
  fetcher(UPSTREAM, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      'HTTP-Referer': 'https://pi.dev',
      'X-OpenRouter-Title': 'pi'
    },
    body: JSON.stringify({ ...body, model, usage: { include: true } }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })

/** @param {AsyncIterable<Uint8Array>} request */
export const read_body = async request => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > LIMIT) throw new Error('request too large')
    chunks.push(chunk)
  }
  return { body: JSON.parse(Buffer.concat(chunks).toString()), size }
}
