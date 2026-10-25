import { read_items } from '#root/lib/items.js'

export const INDEX = 'index.html'

export const NUMBERS = [
  'status',
  'request_bytes',
  'reply_bytes',
  'prompt_tokens',
  'completion_tokens',
  'cached_tokens',
  'cache_write_tokens',
  'latency_ms',
  'cost'
]

/** A day folder's pieces first, then index.html; index is written last. */
export const day_files = files => [
  ...files.filter(name => name.endsWith('.html') && name !== INDEX).sort(),
  INDEX
]

/** Rows as the proxy writes them; unknown text is ignored, one row per call. */
export const read_rows = (html, payer = '') => {
  const rows = []
  const seen = new Set()
  for (const item of read_items(html, 'usage')) {
    /** @type {Record<string, string | number>} */
    const values = { ...item }
    if (values.call) {
      if (seen.has(values.call)) continue
      seen.add(values.call)
    }
    for (const name of NUMBERS) values[name] = Number(values[name] ?? 0)
    values.payer ||= payer
    rows.push(values)
  }
  return rows
}

const free_model = model => typeof model === 'string' && model.endsWith(':free')

/** Tokens a row spends of the free limit: free plan, priced model only. */
export const free_tokens = row =>
  row.plan === 'paid' || free_model(row.model)
    ? 0
    : (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0)

/** Free-plan tokens and all cost; paid rows and free models spend none. */
export const sum_rows = rows => ({
  tokens: rows.reduce((sum, row) => sum + free_tokens(row), 0),
  cost: rows.reduce((sum, row) => sum + (row.cost ?? 0), 0)
})
