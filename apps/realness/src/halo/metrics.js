const MEDIAN = 0.5
const P99 = 0.99
/** Values below `fraction` of the set, by nearest rank. Empty is null. */
export const percentile = (values, fraction) => {
  const sorted = values
    .filter(value => Number.isFinite(value))
    .sort((a, b) => a - b)
  if (!sorted.length) return null
  const rank = Math.ceil(fraction * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]
}

/** The p50 and p99 of one field, with its count. */
export const summarize = values => {
  const numbers = values.filter(value => Number.isFinite(value))
  if (!numbers.length) return null
  return {
    count: numbers.length,
    p50: percentile(numbers, MEDIAN),
    p99: percentile(numbers, P99)
  }
}

const METRICS = ['vm_ms', 'agent_ms', 'init_ms', 'ms', 'probe_ms']

/**
 * One halo's timings, from every actor's traces: create and reload phases,
 * and the response probes this halo has recorded. `read` returns one actor's
 * events, so the caller decides where traces live.
 */
export const metrics_from = (ids, read) => {
  const events = ids.flatMap(id => read(id))
  const out = {}
  for (const event of ['create', 'reload']) {
    const rows = events.filter(row => row.event === event)
    const fields = {}
    for (const field of METRICS) {
      const summary = summarize(rows.map(row => row[field]))
      if (summary) fields[field] = summary
    }
    if (Object.keys(fields).length) out[event] = fields
  }
  const probes = summarize(events.map(row => row.probe_ms))
  if (probes) out.probe = probes
  const turn = summarize(
    events.filter(row => row.event === 'first-turn').map(row => row.ms)
  )
  if (turn) out.turn = turn
  return out
}

/** Flatten to `create_ms_p50` style keys, which the HTML Lines record carries. */
export const metric_fields = metrics => {
  const out = {}
  for (const [event, fields] of Object.entries(metrics)) {
    const phases = fields.count !== undefined ? { '': fields } : fields
    for (const [field, summary] of Object.entries(phases))
      for (const [name, value] of Object.entries(summary))
        out[`${event}${field ? `_${field}` : ''}_${name}`] = value
  }
  return out
}
