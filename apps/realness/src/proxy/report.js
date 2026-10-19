const PERCENT = 100
const DECADE = 10
const MONEY_PLACES = 6
const RATE_PLACES = 4
const P50 = 50
const P95 = 95
const OK_MIN = 200
const OK_MAX = 400

/** Nearest-rank percentile of a list of numbers; 0 when the list is empty. */
export const percentile = (values, rank) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const at = Math.ceil((rank / PERCENT) * sorted.length) - 1
  return sorted[Math.max(0, at)]
}

const round = (value, places) =>
  Math.round(value * DECADE ** places) / DECADE ** places

const sum = (rows, name) =>
  round(
    rows.reduce((total, row) => total + (row[name] ?? 0), 0),
    MONEY_PLACES
  )

/** A failed call is any status outside 2xx; aborted calls have no status. */
export const is_error = row => row.status < OK_MIN || row.status >= OK_MAX

/**
 * Calls, errors, latency percentiles, tokens, cache use, and cost for a set
 * of rows. Percentiles answer what the mean cannot: the slow tail.
 */
export const call_stats = rows => {
  const latency = rows.map(row => row.latency_ms ?? 0)
  const hits = rows.filter(row => (row.cached_tokens ?? 0) > 0).length
  const errors = rows.filter(is_error).length
  return {
    calls: rows.length,
    errors,
    error_rate: rows.length ? round(errors / rows.length, RATE_PLACES) : 0,
    prompt_tokens: sum(rows, 'prompt_tokens'),
    completion_tokens: sum(rows, 'completion_tokens'),
    cached_tokens: sum(rows, 'cached_tokens'),
    cache_write_tokens: sum(rows, 'cache_write_tokens'),
    cache_hits: hits,
    cache_hit_rate: rows.length ? round(hits / rows.length, RATE_PLACES) : 0,
    cost: sum(rows, 'cost'),
    latency_ms: rows.length
      ? Math.round(latency.reduce((total, ms) => total + ms, 0) / rows.length)
      : 0,
    p50_ms: percentile(latency, P50),
    p95_ms: percentile(latency, P95)
  }
}

const grouped = (rows, name) => {
  const groups = new Map()
  for (const row of rows) {
    const key = row[name] || 'unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups.entries()]
    .map(([name, rows]) => ({ name, ...call_stats(rows) }))
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
}

/** Totals plus the same stats grouped by model, provider, and client. */
export const usage_stats = rows => ({
  totals: call_stats(rows),
  by_model: grouped(rows, 'model'),
  by_provider: grouped(rows, 'provider'),
  by_client: grouped(rows, 'client')
})
