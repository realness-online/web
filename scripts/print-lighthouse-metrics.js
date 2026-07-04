import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const lhci_dir = join(process.cwd(), '.lighthouseci')
const runs_per_batch = 5
const PERCENT = 100

const get_lhr_paths = () =>
  readdirSync(lhci_dir)
    .filter(name => name.startsWith('lhr-') && name.endsWith('.json'))
    .sort()
    .slice(-runs_per_batch)
    .map(name => join(lhci_dir, name))

const get_thoughts_render_ms = items => {
  for (const item of items) {
    const name_values = Object.values(item)
      .filter(value => typeof value === 'string')
      .map(value => value.toLowerCase())
    if (!name_values.some(value => value.includes('thoughts-rendered')))
      continue

    const numeric_entry = Object.entries(item).find(([, value]) =>
      Number.isFinite(value)
    )
    if (numeric_entry) return Number(numeric_entry[1])
  }
  return null
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const format_ms = value => (value === null ? 'n/a' : `${Math.round(value)}ms`)

const format_timed = (throttled, observed) => {
  if (throttled === null && observed === null) return 'n/a'
  if (observed === null) return format_ms(throttled)
  if (throttled === null) return `obs ${format_ms(observed)}`
  return `${format_ms(throttled)} (obs ${format_ms(observed)})`
}

const lhr_paths = get_lhr_paths()
if (!lhr_paths.length) {
  console.error('No Lighthouse report found in .lighthouseci')
  process.exit(1)
}

const runs = lhr_paths.map(path => {
  const lhr = JSON.parse(readFileSync(path, 'utf8'))
  const user_timing_items = lhr.audits?.['user-timings']?.details?.items ?? []
  const metrics = lhr.audits?.metrics?.details?.items?.[0] ?? {}

  return {
    path,
    performance: lhr.categories?.performance?.score ?? null,
    fcp: lhr.audits?.['first-contentful-paint']?.numericValue ?? null,
    lcp: lhr.audits?.['largest-contentful-paint']?.numericValue ?? null,
    observed_fcp: metrics.observedFirstContentfulPaint ?? null,
    observed_lcp: metrics.observedLargestContentfulPaint ?? null,
    thoughts_render_ms: get_thoughts_render_ms(user_timing_items)
  }
})

runs.forEach((run, index) => {
  const performance =
    run.performance === null ? 'n/a' : Math.round(run.performance * PERCENT)
  console.info(
    `Run ${index + 1}: Performance ${performance} | FCP ${format_timed(run.fcp, run.observed_fcp)} | LCP ${format_timed(run.lcp, run.observed_lcp)} | Thoughts rendered ${format_ms(run.thoughts_render_ms)}`
  )
})

if (runs.length > 1) {
  const performance_scores = runs
    .map(run => run.performance)
    .filter(value => value !== null)
  const fcps = runs.map(run => run.fcp).filter(value => value !== null)
  const lcps = runs.map(run => run.lcp).filter(value => value !== null)
  const observed_fcps = runs
    .map(run => run.observed_fcp)
    .filter(value => value !== null)
  const observed_lcps = runs
    .map(run => run.observed_lcp)
    .filter(value => value !== null)
  const thoughts = runs
    .map(run => run.thoughts_render_ms)
    .filter(value => value !== null)

  console.info('')
  console.info(
    `Median (${runs.length} runs): Performance ${Math.round(median(performance_scores) * PERCENT)} | FCP ${format_timed(median(fcps), median(observed_fcps))} | LCP ${format_timed(median(lcps), median(observed_lcps))} | Thoughts rendered ${format_ms(median(thoughts))}`
  )
}
