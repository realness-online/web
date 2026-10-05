const UPSTREAM = "https://openrouter.ai/api/v1/chat/completions"
export const MODEL = "thinkingmachines/inkling:free"
// Paid plans may choose the house model; it passes through at cost.
export const HOUSE_MODEL = process.env.HOUSE_MODEL ?? "deepseek/deepseek-v4-flash"
const TIMEOUT_MS = 120_000
const LIMIT = 10 * 1024 * 1024

/** @param {Record<string, unknown>} body */
export const call_upstream = (body, { key, fetcher = fetch, model = MODEL } = {}) =>
  fetcher(UPSTREAM, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://pi.dev",
      "X-OpenRouter-Title": "pi",
    },
    body: JSON.stringify({ ...body, model, usage: { include: true } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

/** @param {AsyncIterable<Uint8Array>} request */
export const read_body = async (request) => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > LIMIT) throw new Error("request too large")
    chunks.push(chunk)
  }
  return { body: JSON.parse(Buffer.concat(chunks).toString()), size }
}

