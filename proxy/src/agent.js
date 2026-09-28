const UPSTREAM = "https://openrouter.ai/api/v1/chat/completions"
const MODEL = "thinkingmachines/inkling:free"
const TIMEOUT_MS = 120_000
const LIMIT = 10 * 1024 * 1024

/** @param {Record<string, unknown>} body */
export const call_upstream = (body, { key, fetcher = fetch } = {}) =>
  fetcher(UPSTREAM, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://pi.dev",
      "X-OpenRouter-Title": "pi",
    },
    body: JSON.stringify({ ...body, model: MODEL }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

/** @param {AsyncIterable<Uint8Array>} request */
export async function read_body(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > LIMIT) throw new Error("request too large")
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString())
}

