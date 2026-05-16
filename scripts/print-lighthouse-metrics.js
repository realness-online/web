import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const lhci_dir = join(process.cwd(), '.lighthouseci')

const get_latest_lhr_path = () => {
  const lhr_files = readdirSync(lhci_dir)
    .filter(name => name.startsWith('lhr-') && name.endsWith('.json'))
    .sort()
  if (!lhr_files.length) return null
  return join(lhci_dir, lhr_files[lhr_files.length - 1])
}

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

const lhr_path = get_latest_lhr_path()
if (!lhr_path) {
  console.error('No Lighthouse report found in .lighthouseci')
  process.exit(1)
}

const lhr = JSON.parse(readFileSync(lhr_path, 'utf8'))

const fcp_audit = lhr.audits?.['first-contentful-paint']
if (fcp_audit?.numericValue)
  console.info(
    `FCP: ${Math.round(fcp_audit.numericValue)}ms (${fcp_audit.displayValue ?? 'n/a'})`
  )
else console.info('FCP: n/a')

const user_timing_items = lhr.audits?.['user-timings']?.details?.items ?? []
const thoughts_render_ms = get_thoughts_render_ms(user_timing_items)
if (thoughts_render_ms !== null)
  console.info(`Thoughts rendered: ${Math.round(thoughts_render_ms)}ms`)
else
  console.info(
    'Thoughts rendered: not found (mark `thoughts-rendered` missing in Lighthouse report)'
  )
