import { BUDGET_USD } from '#root/src/control/scale.js'
import {
  ISO_SECOND,
  ISO_TIME_START,
  MS_PER_MINUTE,
  MS_PER_SECOND
} from '#root/lib/units.js'
import { stripVTControlCharacters as strip_vt } from 'node:util'
import { fileURLToPath as file_u_r_l_to_path } from 'node:url'
import { load_theme } from '#root/themes/load.js'
import { oklch_hex } from '#root/lib/oklch.js'
import {
  braille_line,
  meter,
  fit_first,
  pack,
  panel_box,
  side_by_side,
  sparkline,
  widest
} from './watch-graph.js'

const DEFAULT_WIDTH = 100
const DEFAULT_HEIGHT = 30
const PANEL_WIDTH = 40
const LABEL_SHARE = 0.35
const PHONE_TAIL = 3
const METER_MIN = 4
const METER_MAX = 20
const METER_LABEL = 24
const GRAPH_ROWS = 4
const FAST_MS = 15_000
const SLOW_MS = 300_000
const ESC = '\x1b['
const RESET = `${ESC}0m`
const BOX_SIDES = 4
const DASH_WIDTH = 90
const DASH_HEIGHT = 18
const RIGHT_MAX_SHARE = 0.42
const RIGHT_MIN = 30
const COST_SHARE = 0.4
const MACHINE_METER = 6
const NAME_MIN = 4
const GB = 1_073_741_824
const BUDGET_WARN_SHARE = 0.8
const BUDGET_OVER_SHARE = 0.95
const SPEND_ROWS = 3
const FULL_SHARE = 0.9
const WARN_SHARE = 0.75
const MILLION = 1_000_000
const THOUSAND = 1000
const HALO_METER = 6
const ONE_DECIMAL_BELOW = 10
const DAYS_FALLBACK = 30
const FIXED_SPEND_ROWS = 4
const HEX = 16
const { palette } = load_theme(
  file_u_r_l_to_path(new URL('../../themes/realness', import.meta.url)),
  'realness'
)
/**
 * A palette material as a 24-bit foreground escape body.
 * @param {string} name
 */
const material = name => {
  const [, ...lch] =
    palette.match(
      new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)`)
    ) ?? []
  if (!lch.length) throw new Error(`unknown material: ${name}`)
  const hex = oklch_hex(...lch.map(Number))
  return `38;2;${[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), HEX)).join(';')}`
}

const COLORS = {
  running: '32',
  sleeping: '34',
  parked: '34',
  starting: '33',
  stopping: '33',
  idle: '33',
  quiet: '35',
  failed: '31',
  unknown: '90',
  border: material('clay-fill'),
  title: material('clay-lighten')
}

export const color_enabled = (env = process.env, stream = process.stdout) =>
  env.NO_COLOR !== '1' && stream.isTTY !== false && env.TERM !== 'dumb'

/** Wrap text in a state color; unknown and quiet are dim. */
export const paint = (text, state, on = true) =>
  on && COLORS[state] ? `${ESC}${COLORS[state]}m${text}${RESET}` : String(text)

const width_of = text => [...strip_vt(text)].length

const fit = (text, width) => {
  if (width_of(text) <= width) return text
  const chars = [...strip_vt(text)]
  return `${chars.slice(0, Math.max(0, width - 1)).join('')}…`
}

/** Clip a row to the terminal, so a long line never wraps into the next. */
const clip = (text, width) =>
  width_of(text) <= width ? text : fit(text, width)

/**
 * A dim label above clipped data rows, with no filled background.
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.detail]
 * @param {string[]} [options.lines]
 * @param {number} [options.width]
 * @param {boolean} [options.on]
 */
export const panel = ({
  title,
  detail = '',
  lines = [],
  width = PANEL_WIDTH,
  on = true
}) => {
  const inner = Math.max(8, width - 2)
  const head = `${title}${detail ? ` ${detail}` : ''}`
  const out = [paint(fit(head, inner), 'unknown', on)]
  for (const line of lines) out.push(clip(line, inner))
  return out
}

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

/** A service's state word; `missing` says how to show one never deployed. */
const service_state = (service, missing) => {
  if (!service.found) return missing
  return service.ready ? 'ready' : 'NOT READY'
}

const age = seconds => {
  if (seconds === null || seconds === undefined) return '-'
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`
  if (seconds < SECONDS_PER_HOUR)
    return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m`
  return `${Math.floor(seconds / SECONDS_PER_HOUR)}h`
}

const usd = value => `$${Number(value).toFixed(2)}`

/** Wrap long paths instead of hiding their ends. */
const wrap = (text, width) => {
  const rows = []
  const chars = [...String(text)]
  for (let at = 0; at < chars.length; at += Math.max(1, width))
    rows.push(chars.slice(at, at + Math.max(1, width)).join(''))
  return rows.length ? rows : ['']
}

/** Relative bars show cost drivers; the dollar values remain exact to cents. */
export const cost_bars = (rows, width = DEFAULT_WIDTH) => {
  const sums = new Map()
  for (const row of rows)
    sums.set(row.service, (sums.get(row.service) ?? 0) + row.net)
  const costs = [...sums]
    .filter(([, cost]) => cost !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  if (!costs.length) return ['No net charges recorded']
  const shown = costs.slice(0, 5)
  if (costs.length > 5)
    shown.push([
      'Other',
      costs.slice(5).reduce((sum, [, cost]) => sum + cost, 0)
    ])
  const label_width = Math.min(
    Math.max(...shown.map(([label]) => label.length)),
    Math.max(8, Math.floor(width * LABEL_SHARE))
  )
  const money_width = Math.max(...shown.map(([, cost]) => usd(cost).length))
  const bar_width = Math.max(1, width - label_width - money_width - 3)
  const maximum = Math.max(...shown.map(([, cost]) => Math.abs(cost)))
  return shown.map(
    ([label, cost]) =>
      `${fit(label, label_width).padEnd(label_width)} ${usd(cost).padStart(money_width)} ${cost === 0 ? '' : (cost < 0 ? '-' : '#').repeat(Math.max(1, Math.round((Math.abs(cost) / maximum) * bar_width)))}`
  )
}

export const billing_lines = (
  result,
  width = DEFAULT_WIDTH,
  on = true,
  now = Date.now()
) => {
  if (result?.status !== 'ok')
    return [paint('UNAVAILABLE - cloud bill not included', 'failed', on)]
  const exports = result.exports ?? []
  if (!exports.length)
    return [paint('UNAVAILABLE - no billing export data', 'failed', on)]
  const total = exports.reduce((sum, bill) => sum + bill.total, 0)
  const days = new Map()
  for (const bill of exports)
    for (const day of bill.daily ?? [])
      days.set(day.date, (days.get(day.date) ?? 0) + day.cost)
  const daily = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({ date, cost }))
  return [
    `MONTH ${usd(total)}  cloud charges after credits`,
    ...spend_numbers(daily),
    ...spend_line(daily, width, on),
    '',
    'Largest costs this month',
    ...cost_bars(
      exports.flatMap(bill => bill.rows),
      width
    )
  ]
}

export const resource_lines = (result, width = DEFAULT_WIDTH, on = true) => {
  if (result?.status !== 'ok')
    return [paint('UNAVAILABLE - cloud machine and disk state', 'failed', on)]
  const inventories = result.inventories ?? []
  const instances = inventories.flatMap(item => item.instances)
  const disks = inventories.flatMap(item => item.disks)
  const running = instances.filter(row => row.status === 'RUNNING').length
  const stopped = instances.filter(row => row.status === 'TERMINATED').length
  const meter_width = Math.max(
    METER_MIN,
    Math.min(METER_MAX, width - METER_LABEL)
  )
  const lines = [
    instances.length
      ? `${paint(meter(running / instances.length, meter_width), running ? 'running' : 'sleeping', on)} ${running} running cloud machines  ${stopped} stopped`
      : `${running} running cloud machines  ${stopped} stopped`
  ]
  for (const row of instances) {
    const state = row.status === 'TERMINATED' ? 'STOPPED' : row.status
    lines.push(
      ...wrap(`${row.name}  ${state}`, width).map(line =>
        paint(line, row.status === 'TERMINATED' ? 'sleeping' : 'idle', on)
      )
    )
  }
  const size = disks.reduce((sum, row) => sum + row.size_gb, 0)
  lines.push(
    disks.length
      ? `${disks.length} disks / ${size} GB retained - storage charges continue`
      : 'No persistent disks found'
  )
  const unattached = disks.filter(disk => !disk.attached.length)
  if (unattached.length)
    lines.push(paint(`${unattached.length} disks are unattached`, 'idle', on))
  return lines
}

const service_lines = (result, width = DEFAULT_WIDTH, on = true) => {
  if (result?.status !== 'ok')
    return [
      paint('UNAVAILABLE - cloud service status', 'failed', on),
      ...wrap(result?.error ?? 'no service source', width)
    ]
  return (result.rows ?? []).flatMap(row =>
    wrap(
      `${row.name}  ${service_state(row, 'MISSING')}  ${row.project}`,
      width
    ).map(line =>
      paint(line, row.found && row.ready ? 'running' : 'failed', on)
    )
  )
}

const count = value =>
  value === null || value === undefined ? '-' : String(value)

export const halo_lines = (rows = [], on = true) =>
  rows.length
    ? rows.map(row => {
        const actors = row.actors
          ? `${row.actors.running} running, ${row.actors.idle} idle, ${row.actors.stopped} stopped`
          : '-'
        const text = `${row.name}  ${row.state}  report ${age(row.age_s)} ago  ${actors}`
        return `${paint(text, row.state, on)}${row.detail ? paint(`  ${row.detail}`, 'unknown', on) : ''}`
      })
    : ['no halo records']

/** Latest day, daily average, and peak day, aligned as a numeric panel. */
const spend_numbers = (daily = []) => {
  if (!daily.length) return []
  const costs = daily.map(day => day.cost)
  const peak = daily.reduce((top, day) => (day.cost > top.cost ? day : top))
  const cells = [
    ['LATEST', usd(costs.at(-1))],
    ['AVG/DAY', usd(costs.reduce((sum, cost) => sum + cost, 0) / costs.length)],
    ['PEAK', `${usd(peak.cost)} ${peak.date.slice(5)}`]
  ]
  return [cells.map(([label, value]) => `${label} ${value}`).join('   ')]
}

/** Daily cloud cost as a Braille line, labelled with its high and low. */
const spend_line = (daily = [], width = 80, on = true, height = GRAPH_ROWS) => {
  if (!daily.length) return ['daily history unavailable']
  const costs = daily.map(day => day.cost)
  const high = usd(Math.max(...costs))
  const low = usd(Math.min(...costs))
  const label = Math.max(high.length, low.length)
  const plot = braille_line(costs, Math.max(1, width - label - 3), height)
  return [
    ...plot.map((row, at) => {
      let axis = ''
      if (at === 0) axis = high
      else if (at === plot.length - 1) axis = low
      return `${axis.padStart(label)} ┤ ${paint(row, 'running', on)}`
    }),
    `${' '.repeat(label)}   ${daily[0].date.slice(5)} to ${daily.at(-1).date.slice(5)}; daily`
  ]
}

/** Daily cost bars share a zero baseline; narrow views sum adjacent days. */
export const spend_chart = (daily = [], width = 80) => {
  if (!daily.length) return ['daily history unavailable']
  const height = 4
  const peak = Math.max(...daily.map(day => Math.abs(day.cost)), 0)
  const label = usd(peak)
  const available = Math.max(1, width - label.length - 3)
  const stride = Math.max(1, Math.ceil(daily.length / available))
  const bins = []
  for (let at = 0; at < daily.length; at += stride)
    bins.push(
      daily.slice(at, at + stride).reduce((sum, day) => sum + day.cost, 0)
    )
  const maximum = Math.max(...bins.map(Math.abs), 0)
  const positive_peak = Math.max(...bins, 0)
  const negative_peak = Math.min(...bins, 0)
  const spacing = bins.length * 2 - 1 <= available ? ' ' : ''
  const rows = []
  for (let level = height; level > 0; level--) {
    const axis = level === height ? usd(positive_peak) : ''
    const bars = bins
      .map(cost =>
        cost > 0 && Math.ceil((cost / maximum) * height) >= level ? '#' : ' '
      )
      .join(spacing)
    rows.push(`${axis.padStart(label.length)} | ${bars}`)
  }
  rows.push(
    `${'$0'.padStart(label.length)} + ${'-'.repeat(bins.length + spacing.length * (bins.length - 1))}`
  )
  if (negative_peak < 0)
    for (let level = 1; level <= height; level++) {
      const axis = level === height ? usd(negative_peak) : ''
      const bars = bins
        .map(cost =>
          cost < 0 && Math.ceil((Math.abs(cost) / maximum) * height) >= level
            ? '-'
            : ' '
        )
        .join(spacing)
      rows.push(`${axis.padStart(label.length)} | ${bars}`)
    }

  rows.push(
    `${daily[0].date.slice(5)} to ${daily.at(-1).date.slice(5)}${stride > 1 ? `; ${stride}-day totals` : '; daily'}`
  )
  return rows
}

const spend_lines = (rows = [], width = 80) =>
  rows.length
    ? rows.flatMap(row => [
        `${row.phone.slice(0, 5)}...${row.phone.slice(-PHONE_TAIL)}  TODAY ${usd(row.day.cost)}  MONTH ${usd(row.month.cost)}`,
        ...(row.daily?.some(day => day.cost !== 0)
          ? spend_chart(row.daily, width)
          : [
              row.daily?.length
                ? 'No recorded model cost this month'
                : 'daily history unavailable'
            ])
      ])
    : ['no ledger for this token']

const percent = value => `${(Number(value) * PERCENT).toFixed(1)}%`
const millis = value => `${Math.round(value)}ms`

export const model_summary = report => {
  const totals = report?.totals
  if (!totals?.calls) return 'no model calls today'
  const errors = `${totals.errors} ${totals.errors === 1 ? 'error' : 'errors'} (${percent(totals.error_rate)})`
  return `${totals.calls} calls  ${errors}  p50 ${millis(totals.p50_ms)}  p95 ${millis(totals.p95_ms)}  cache ${percent(totals.cache_hit_rate)}  ${usd(totals.cost)}`
}

/** Today's calls across people, plus the busiest models and clients. */
export const model_lines = (report, on = true, width = DEFAULT_WIDTH) => {
  if (report?.status === 'failed')
    return [paint(`FAILED ${report.error}`, 'failed', on)]
  if (!report?.totals) return ['no model report']
  const lines = [
    paint(
      model_summary(report),
      report.totals.errors ? 'failed' : 'running',
      on
    )
  ]
  const group = (label, rows = []) =>
    rows
      .slice(0, 3)
      .map(row =>
        clip(
          `${label} ${row.name}  ${row.calls} calls  ${row.errors} errors  p95 ${millis(row.p95_ms)}  ${usd(row.cost)}`,
          width
        )
      )
  lines.push(...group('model', report.by_model))
  lines.push(...group('client', report.by_client))
  return lines
}

export const sync_lines = (rows = [], on = true, width = DEFAULT_WIDTH) => {
  if (!rows.length) return ['no folders configured']
  const unread = rows.filter(row => !row.listing)
  const missing = rows.filter(row => row.listing && !row.last_sync)
  const lines = [
    `${rows.length - unread.length}/${rows.length} folders readable; ${missing.length} without a local sync record`
  ]
  for (const row of unread)
    lines.push(
      ...wrap(`Cannot read: ${row.folder}`, width).map(line =>
        paint(line, 'failed', on)
      )
    )
  for (const row of missing)
    lines.push(...wrap(`No local sync record: ${row.folder}`, width))
  return lines
}

const sign_on_lines = info =>
  info?.rows?.length
    ? info.rows.map(
        row =>
          `signed in  ${row.phone}  ${row.expires_at ? `until ${row.expires_at.slice(ISO_TIME_START, ISO_SECOND)}Z` : 'no expiry'}`
      )
    : [info?.detail ?? 'not signed in']

const publish_lines = (rows = []) =>
  rows.length
    ? rows.map(
        row =>
          `${row.phone}  sites ${count(row.sites)}${row.detail ? `  ${row.detail}` : ''}`
      )
    : ['nothing published']

const error_lines = (panel_result, on = true) =>
  panel_result?.status === 'failed'
    ? [
        paint(`FAILED ${panel_result.error}`, 'failed', on),
        paint(
          `last read ${panel_result.at?.slice(ISO_TIME_START, ISO_SECOND) ?? '-'}Z`,
          'unknown',
          on
        )
      ]
    : []

/** Ordered monitor rows, shared by rendering and scroll bounds. */
/** Every panel with its full rows, for the scrollable detail view. */
const detail_rows = (panels, width, on, now) => {
  const rows = []
  const section = (title, lines) =>
    rows.push(
      paint(title, 'unknown', on),
      ...lines.map(line => clip(line, width)),
      ''
    )
  const { billing } = panels
  const scope = (billing?.exports ?? []).flatMap(bill => [
    ...wrap(`Export: ${bill.table}`, width),
    `Usage through ${bill.through}; queried ${bill.checked}`
  ])
  section('BILLING DETAILS', error_lines(billing, on).concat(scope))
  section(
    'CLOUD SERVICES',
    error_lines(panels.services, on).concat(
      service_lines(panels.services, width, on)
    )
  )
  const resources = (panels.resources?.inventories ?? []).flatMap(inventory => [
    ...inventory.instances.map(
      row => `${row.name}  ${row.status}  ${row.machine}  ${inventory.project}`
    ),
    ...inventory.disks.map(
      row =>
        `${row.name}  ${row.size_gb} GB  ${row.attached.length ? row.attached.join(', ') : 'unattached'}`
    )
  ])
  const inventories = panels.resources?.inventories ?? []
  const inventory_summary =
    panels.resources?.status === 'ok'
      ? `Cloud inventory: ${inventories.reduce((sum, item) => sum + item.instances.length, 0)} machines, ${inventories.reduce((sum, item) => sum + item.disks.length, 0)} disks`
      : 'Cloud inventory unavailable'
  section('CLOUD RESOURCE DETAILS', [
    inventory_summary,
    ...error_lines(panels.resources, on),
    ...resources
  ])
  const reports = (panels.halos?.rows ?? []).map(row =>
    paint(
      `${row.name}  ${row.age_s === null || row.age_s === undefined ? 'no dated agent report' : `last agent report ${age(row.age_s)} ago`}`,
      'unknown',
      on
    )
  )
  section('AGENT REPORT HISTORY', error_lines(panels.halos, on).concat(reports))
  section(
    'MODEL CALLS - today, all people',
    model_lines(panels.model, on, width)
  )
  section(
    'MODEL SPEND - account ledger only',
    error_lines(panels.cost, on).concat(spend_lines(panels.cost?.rows, width))
  )
  section(
    'SYNC',
    error_lines(panels.sync, on).concat(
      sync_lines(panels.sync?.rows, on, width)
    )
  )
  rows.push(
    ...error_lines(panels.sign_on, on),
    ...error_lines(panels.publish, on),
    ...sign_on_lines(panels.sign_on),
    ...publish_lines(panels.publish?.rows)
  )
  return rows
}

/** One line per cloud, sync, halo, and cost problem. */
/** One line per cloud service, naming each one that is not ready. */
const cloud_service_lines = (panels, on) => {
  if (panels.services?.status !== 'ok')
    return [paint('Cloud service status unavailable', 'failed', on)]
  const services = panels.services.rows ?? []
  const problems = services.filter(row => !row.found || !row.ready)
  if (!problems.length) return [`${services.length} cloud services ready`]
  return problems.map(row =>
    paint(
      `${row.name}: ${row.found ? 'NOT READY' : 'MISSING'} in ${row.project}`,
      'failed',
      on
    )
  )
}

const status_lines = (panels, width, on) => {
  const status = [...cloud_service_lines(panels, on)]
  if (panels.sync?.status === 'failed')
    status.push(paint('Sync read failed - see details', 'failed', on))
  else
    for (const row of panels.sync?.rows ?? [])
      if (!row.listing)
        status.push(
          ...wrap(
            `Cannot read sync folder ${row.folder}: ${row.error ?? 'no reason given'}`,
            width
          )
        )
      else if (row.newest)
        status.push(
          ...wrap(
            `Newest synced session: ${new Date(row.newest).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
            width
          )
        )
  const running = new Set(
    (panels.resources?.inventories ?? []).flatMap(inventory =>
      inventory.instances
        .filter(row => row.status === 'RUNNING')
        .map(row => row.name)
    )
  )
  for (const row of panels.halos?.rows ?? [])
    if (running.has(row.name) && row.state === 'quiet')
      status.push(
        paint(
          `${row.name}: cloud machine running, agent report missing`,
          'idle',
          on
        )
      )
  if (panels.cost?.status === 'failed')
    status.push('Model cost unavailable - see details')
  if (panels.model?.status === 'failed')
    status.push('Model call stats unavailable - see details')
  else if (panels.model?.totals?.errors)
    status.push(
      paint(`Model calls: ${model_summary(panels.model)}`, 'failed', on)
    )
  if (panels.traffic?.refresh?.state === 'failed')
    status.push(
      ...wrap(
        `Site traffic not refreshing: ${panels.traffic.refresh.error}`,
        width
      ).map(line => paint(line, 'failed', on))
    )
  return status
}

export const frame_rows = (
  snapshot,
  width = DEFAULT_WIDTH,
  on = true,
  details = false,
  now = Date.now()
) => {
  const panels = snapshot?.panels ?? {}
  const rows = []
  const section = (title, lines) =>
    rows.push(
      paint(title, 'unknown', on),
      ...lines.map(line => clip(line, width)),
      ''
    )
  if (details) return detail_rows(panels, width, on, now)
  section('CLOUD BILLING', billing_lines(panels.billing, width, on, now))
  const checked = Date.parse(panels.resources?.checked ?? '')
  const resource_age = Number.isFinite(checked)
    ? `  read ${age(Math.max(0, Math.floor((now - checked) / MS_PER_SECOND)))} ago`
    : ''
  section(
    `CLOUD MACHINES${resource_age}`,
    resource_lines(panels.resources, width, on)
  )
  const status = status_lines(panels, width, on)
  section('STATUS', status)
  if (panels.model?.status === 'ok' && panels.model.totals?.calls)
    section(
      'MODEL CALLS - today, all people',
      model_lines(panels.model, on, width)
    )
  const model_cost = panels.cost?.rows ?? []
  if (model_cost.some(row => row.month.cost !== 0))
    section('MODEL SPEND - separate from cloud', [
      `TODAY ${usd(model_cost.reduce((sum, row) => sum + row.day.cost, 0))}  MONTH ${usd(model_cost.reduce((sum, row) => sum + row.month.cost, 0))}`
    ])
  return rows
}

/**
 * Billing first, with scrollable sections and a fixed control footer.
 * @param {object} options
 * @param {object | null} [options.snapshot]
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @param {number} [options.interval_ms]
 * @param {number} [options.now]
 * @param {boolean} [options.on]
 * @param {string | null} [options.message] the last read failure, or null
 * @param {number} [options.offset]
 * @param {boolean} [options.details]
 */
export const frame = ({
  snapshot,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  interval_ms = MS_PER_MINUTE,
  now = Date.now(),
  on = true,
  message = null,
  offset = 0,
  details = false
}) => {
  const head = `${paint('REALNESS SERVICE WATCH', 'title', on)}  ${details ? 'details' : 'costs'}  every ${Math.round(interval_ms / MS_PER_SECOND)}s${message ? `  ${paint(message, 'idle', on)}` : ''}`
  if (!details && width >= DASH_WIDTH && height >= DASH_HEIGHT)
    return `${[
      fit(head, width),
      ...dashboard(
        /** @type {any} */ (snapshot)?.panels ?? {},
        width,
        height - 2,
        on,
        now
      ),
      fit(
        paint(
          '^C quit  r refresh  d details  u 15s  m 60s  h 5m',
          'unknown',
          on
        ),
        width
      )
    ].join('\n')}\n`
  const inner = Math.max(1, width - BOX_SIDES)
  const rows = frame_rows(snapshot, inner, on, details, now)
  const capacity = body_capacity(height)
  const start = Math.min(offset, Math.max(0, rows.length - capacity))
  const body = rows.slice(start, start + capacity)
  while (body.length < capacity) body.push('')
  const position =
    rows.length > capacity
      ? `rows ${start + 1}-${start + body.length}/${rows.length}  j/k scroll`
      : ''
  const footer =
    `^C quit  r refresh  d ${details ? 'costs' : 'details'}  u 15s  m 60s  h 5m  ${position}`.trimEnd()
  return `${box({ head, footer, body, width, on }).join('\n')}\n`
}

/**
 * Clay-bordered panel helper bound to the color switch.
 * @param {string} title
 * @param {string[]} lines
 * @param {number} width
 * @param {number} height
 * @param {boolean} on
 */
const tile = (title, lines, width, height, on) =>
  panel_box({
    title,
    lines,
    width,
    height,
    edge: text => paint(text, 'border', on),
    label: text => paint(text, 'title', on)
  })

/** Merged daily cloud cost across billing exports, oldest first. */
const daily_cloud = exports => {
  const days = new Map()
  for (const bill of exports)
    for (const day of bill.daily ?? [])
      days.set(day.date, (days.get(day.date) ?? 0) + day.cost)
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({ date, cost }))
}

/**
 * Free capacity as a used-share meter with used and total in GB.
 * @param {string} label
 * @param {number | null | undefined} free bytes
 * @param {number | null | undefined} total bytes
 * @param {boolean} on
 */
const usage = (label, free, total, on, bar = true) => {
  if (!total || free === null || free === undefined) return `${label} -`
  const used = Math.max(0, total - free)
  const share = used / total
  let state = 'running'
  if (share > FULL_SHARE) state = 'failed'
  else if (share > WARN_SHARE) state = 'idle'
  return `${label} ${bar ? `${paint(meter(share, HALO_METER), state, on)} ` : ''}${(used / GB).toFixed(used / GB < ONE_DECIMAL_BELOW ? 1 : 0)}/${(total / GB).toFixed(0)}G`
}

/** Two rows per halo: actors and report age, then memory and disk meters. */
const halo_panel_lines = (halos, on, width = DEFAULT_WIDTH) => {
  if (halos?.status === 'failed') return [paint('UNAVAILABLE', 'failed', on)]
  const rows = halos?.rows ?? []
  if (!rows.length) return ['no halo records']
  return rows.flatMap(row => {
    const name = paint(row.name, row.state, on)
    const seen =
      row.age_s === null || row.age_s === undefined
        ? 'no report'
        : `${age(row.age_s)} ago`
    const { actors } = row
    return [
      fit_first(
        actors
          ? [
              `${name}  ${actors.running} run ${actors.idle} idle ${actors.stopped} stop  ${seen}`,
              `${name}  ${actors.running}/${actors.idle}/${actors.stopped}  ${seen}`,
              `${name} ${seen}`
            ]
          : [`${name}  ${row.state}  ${seen}`, `${name} ${seen}`],
        width
      ),
      actors
        ? fit_first(
            [
              `${usage('mem', row.mem_free, row.mem_total, on)}  ${usage('disk', row.volume_free, row.volume_size, on)}`,
              `${usage('mem', row.mem_free, row.mem_total, on, false)}  ${usage('disk', row.volume_free, row.volume_size, on, false)}`
            ],
            width
          )
        : paint(row.detail ?? '', 'unknown', on)
    ]
  })
}

/** Month-to-date total extended at the daily average to the month's end. */
const projection = (total, daily) => {
  if (!daily.length) return null
  const [year, month] = daily.at(-1).date.split('-').map(Number)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate() || DAYS_FALLBACK
  const average = daily.reduce((sum, day) => sum + day.cost, 0) / daily.length
  return total + average * Math.max(0, days - daily.length)
}

/** Token counts shortened to k or M. */
const tokens = count => {
  if (count >= MILLION) return `${(count / MILLION).toFixed(1)}M`
  if (count >= THOUSAND) return `${Math.round(count / THOUSAND)}k`
  return String(count ?? 0)
}

const LIGHT = '●'
const MIN_TILE = 3
const PERCENT = 100
const STALE_TRAFFIC_MS = 86_400_000
const SERVICES = ['sync', 'proxy', 'gate']

/**
 * The halo light: running and reporting, sleeping, quiet, or unknown.
 * @param {any} halos
 */
const halo_light = halos => {
  if (halos?.status === 'failed') return 'unknown'
  const rows = halos?.rows ?? []
  if (!rows.length) return 'unknown'
  if (rows.some(row => row.state === 'quiet')) return 'quiet'
  if (rows.some(row => row.state === 'running' || row.state === 'idle'))
    return 'running'
  return 'sleeping'
}

/**
 * A service light from Cloud Run's Ready condition; reads never wake it.
 * @param {any} services
 * @param {string} name
 */
const service_light = (services, name) => {
  if (services?.status !== 'ok') return 'unknown'
  const row = (services.rows ?? []).find(item => item.name.endsWith(`-${name}`))
  if (!row) return 'unknown'
  return row.found && row.ready ? 'running' : 'failed'
}

const LIGHT_WORDS = {
  running: 'ok',
  sleeping: 'asleep',
  quiet: 'quiet',
  failed: 'down',
  unknown: '?'
}

/** One colored light per piece; without color each light names its state. */
export const health_lights = (panels, on = true, width = DEFAULT_WIDTH) => {
  const lights = [
    ['halo', halo_light(panels.halos)],
    ...SERVICES.map(name => [name, service_light(panels.services, name)])
  ]
  const lit = lights.map(
    ([name, state]) => `${paint(LIGHT, state, on)} ${name}`
  )
  const said = lights.map(
    ([name, state]) => `${LIGHT} ${name} ${LIGHT_WORDS[state]}`
  )
  const bare = lights.map(([name, state]) => `${name} ${LIGHT_WORDS[state]}`)
  const variants = on
    ? ['   ', '  ', ' '].map(gap => lit.join(gap))
    : [said.join('  '), said.join(' '), bare.join(' ')]
  return [fit_first(variants, width)]
}

/**
 * Human page views this week against last week, a daily trend, and how the
 * local archive stands: quiet when Cloud Logging has no newer requests, or
 * not refreshing when the last gcloud read failed.
 * @param {any} traffic
 * @param {number} width
 * @param {boolean} on
 * @param {number} now
 */
export const traffic_lines = (traffic, width, on = true, now = Date.now()) => {
  if (!traffic) return [paint('no archive; npm run traffic', 'unknown', on)]
  if (traffic.status === 'failed')
    return [paint(traffic.error ?? 'UNAVAILABLE', 'unknown', on)]
  let change = ''
  if (traffic.previous)
    change = `  ${traffic.people >= traffic.previous ? '↑' : '↓'}${Math.abs(Math.round(((traffic.people - traffic.previous) / traffic.previous) * PERCENT))}%`
  const rejected = traffic.refresh?.state === 'failed'
  const reading = traffic.refresh?.state === 'ok'
  const stale = now - Date.parse(traffic.newest ?? '')
  const stale_note =
    stale > STALE_TRAFFIC_MS
      ? `archive ${age(Math.floor(stale / MS_PER_SECOND))} old${reading ? ', still reading' : ''}`
      : ''
  const refresh_note = rejected ? 'not refreshing' : stale_note
  const notes = refresh_note
    ? [paint(refresh_note, rejected ? 'unknown' : 'idle', on)]
    : []
  return [
    fit_first(
      [
        `7d ${traffic.people} people${change}  ${traffic.deeper} went deeper  ${traffic.outside} from other sites`,
        `7d ${traffic.people} people${change}  ${traffic.deeper} went deeper  ${traffic.outside} from other sites`,
        `7d ${traffic.people} people${change}  ${traffic.deeper} deeper  ${traffic.outside} referred`,
        `${traffic.people} people${change}`
      ],
      width
    ),
    paint(
      sparkline(
        (traffic.daily ?? []).map(day => day.people),
        width
      ),
      'running',
      on
    ),
    ...notes,
    traffic.daily?.length
      ? paint(
          `${traffic.daily[0].date.slice(5)} to ${traffic.daily.at(-1).date.slice(5)}; people per day`,
          'unknown',
          on
        )
      : ''
  ]
}

/**
 * Model spend today and this month with tokens, then the daily trend.
 * @param {any} cost
 * @param {number} width
 * @param {boolean} on
 */
const model_panel_lines = (cost, width, on) => {
  const model_rows = cost?.rows ?? []
  const model_daily = new Map()
  for (const row of model_rows)
    for (const day of row.daily ?? [])
      model_daily.set(day.date, (model_daily.get(day.date) ?? 0) + day.cost)
  const model_values = [...model_daily]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, cost]) => cost)
  const today = usd(model_rows.reduce((sum, row) => sum + row.day.cost, 0))
  const month = usd(model_rows.reduce((sum, row) => sum + row.month.cost, 0))
  const today_tokens = model_rows.reduce(
    (sum, row) => sum + (row.day.tokens ?? 0),
    0
  )
  const month_tokens = model_rows.reduce(
    (sum, row) => sum + (row.month.tokens ?? 0),
    0
  )
  return cost?.status === 'failed'
    ? [paint('UNAVAILABLE', 'failed', on)]
    : [
        fit_first(
          [
            `today ${today} ${tokens(today_tokens)}  month ${month} ${tokens(month_tokens)}`,
            `today ${today}  month ${month}`,
            `${today} / ${month}`
          ],
          width
        ),
        model_values.some(value => value !== 0)
          ? paint(sparkline(model_values, width), 'running', on)
          : paint('no model use this month', 'unknown', on)
      ]
}

/**
 * One row per cloud machine with a power meter, then retained disks.
 * @param {any} resources
 * @param {boolean} on
 */
const machine_panel = (resources, on) => {
  const inventories =
    resources?.status === 'ok' ? (resources.inventories ?? []) : []
  const instances = inventories.flatMap(item => item.instances)
  const disks = inventories.flatMap(item => item.disks)
  const running = instances.filter(row => row.status === 'RUNNING').length
  const name_width = Math.max(
    NAME_MIN,
    ...instances.map(row => row.name.length)
  )
  const machine_lines =
    resources?.status === 'ok'
      ? [
          ...instances.map(row => {
            const up = row.status === 'RUNNING'
            return `${row.name.padEnd(name_width)} ${paint(meter(up ? 1 : 0, MACHINE_METER), up ? 'running' : 'sleeping', on)} ${paint(up ? 'RUNNING' : 'STOPPED', up ? 'running' : 'sleeping', on)}`
          }),
          disks.length
            ? `${disks.length} disks / ${disks.reduce((sum, disk) => sum + disk.size_gb, 0)} GB retained${disks.some(disk => !disk.attached.length) ? ` · ${disks.filter(disk => !disk.attached.length).length} unattached` : ''}`
            : 'no persistent disks'
        ]
      : [paint('UNAVAILABLE', 'failed', on)]
  return {
    title: instances.length
      ? `MACHINES  ${running}/${instances.length} running`
      : 'MACHINES',
    lines: machine_lines
  }
}

/**
 * The width the right column needs to show every line at full length.
 * @param {any} panels
 * @param {boolean} on
 */
const right_natural = (panels, on) =>
  widest([
    ...health_lights(panels, on, Infinity),
    ...machine_panel(panels.resources, on).lines,
    ...halo_panel_lines(panels.halos, on, Infinity),
    model_panel_lines(panels.cost, Infinity, on)[0]
  ]) + BOX_SIDES

/**
 * Cloud plus model spend this month against the monthly budget, projected to
 * month end, with paying people and margin. Every reading is exact; the
 * projection says it is one.
 * @param {any} panels
 * @param {number} width
 * @param {boolean} on
 */
export const budget_panel_lines = (panels, width, on) => {
  const exports =
    panels.billing?.status === 'ok' ? (panels.billing.exports ?? []) : []
  const daily = daily_cloud(exports)
  const cloud = exports.reduce((sum, bill) => sum + bill.total, 0)
  const model = (panels.cost?.rows ?? []).reduce(
    (sum, row) => sum + row.month.cost,
    0
  )
  const spent = cloud + model
  const share = spent / BUDGET_USD
  let state = 'running'
  if (share > BUDGET_OVER_SHARE) state = 'failed'
  else if (share > BUDGET_WARN_SHARE) state = 'idle'
  const forecast = projection(spent, daily)
  const by = exports.length
    ? `cloud ${usd(cloud)}  model ${usd(model)}`
    : `model ${usd(model)}  cloud unread`
  const { plans } = panels
  let paying = 'payers unread'
  if (plans && plans.status !== 'failed')
    paying = `${plans.paying} paying${plans.granted ? ` +${plans.granted} granted` : ''}  ${usd(plans.revenue)}/mo${
      forecast === null ? '' : `  margin ${usd(plans.revenue - forecast)}`
    }`
  return [
    fit_first(
      [
        `${usd(spent)} of ${usd(BUDGET_USD)}${forecast === null ? '' : `  → ${usd(forecast)}`}  ${Math.round(share * PERCENT)}% used`,
        `${usd(spent)} / ${usd(BUDGET_USD)}${forecast === null ? '' : ` → ${usd(forecast)}`}  ${Math.round(share * PERCENT)}%`
      ],
      width
    ),
    `${paint(meter(share, Math.max(METER_MIN, Math.min(METER_MAX, width - 2))), state, on)} ${by}`,
    paying
  ]
}

/** Spend graph and cost table on the left; machines, models, status right. */
const dashboard = (panels, width, height, on, now) => {
  const right = Math.max(
    RIGHT_MIN,
    Math.min(Math.floor(width * RIGHT_MAX_SHARE), right_natural(panels, on))
  )
  const left = width - right
  const { billing } = panels
  const exports = billing?.status === 'ok' ? (billing.exports ?? []) : []
  const costs_lines = exports.length
    ? cost_bars(
        exports.flatMap(bill => bill.rows),
        left - BOX_SIDES
      )
    : []
  const costs_height = Math.min(
    costs_lines.length + 2,
    Math.floor(height * COST_SHARE)
  )
  const budget_view = budget_panel_lines(panels, left - BOX_SIDES, on)
  const traffic_view = traffic_lines(panels.traffic, left - BOX_SIDES, on, now)
  const traffic_height = traffic_view.length + 2
  const spend_height =
    height -
    (costs_lines.length ? costs_height : 0) -
    traffic_height -
    SPEND_ROWS
  const daily = daily_cloud(exports)
  const total = exports.reduce((sum, bill) => sum + bill.total, 0)
  const spend = exports.length
    ? [
        ...spend_numbers(daily),
        ...spend_line(
          daily,
          left - BOX_SIDES,
          on,
          Math.max(1, spend_height - FIXED_SPEND_ROWS)
        )
      ]
    : billing_lines(billing, left - BOX_SIDES, on, now)
  const left_column = [
    ...tile(
      exports.length
        ? `CLOUD SPEND  MONTH ${usd(total)}${projection(total, daily) === null ? '' : `  → ${usd(projection(total, daily))}`}`
        : 'CLOUD SPEND',
      spend,
      left,
      spend_height,
      on
    ),
    ...tile('BUDGET', budget_view, left, SPEND_ROWS, on),
    ...tile('SITE TRAFFIC  homepage', traffic_view, left, traffic_height, on),
    ...(costs_lines.length
      ? tile('LARGEST COSTS', costs_lines, left, costs_height, on)
      : [])
  ]

  const { title: machines_title, lines: machine_lines } = machine_panel(
    panels.resources,
    on
  )
  const machines_height = Math.min(
    machine_lines.length + 2,
    Math.floor(height / 2)
  )
  const calls =
    panels.model?.status === 'ok' && panels.model.totals?.calls
      ? [
          paint(
            `CALLS ${model_summary(panels.model)}`,
            panels.model.totals.errors ? 'failed' : 'running',
            on
          )
        ]
      : []
  const model_lines = [
    ...model_panel_lines(panels.cost, right - BOX_SIDES, on),
    ...calls
  ]
  const lights = health_lights(panels, on, right - BOX_SIDES)
  const halo_lines = halo_panel_lines(panels.halos, on, right - BOX_SIDES)
  const model_height = model_lines.length + 2
  const health_height = lights.length + 2
  const fixed = health_height + model_height
  const machines_rows = Math.min(
    machines_height,
    Math.max(MIN_TILE, height - fixed - MIN_TILE)
  )
  let halos_rows = Math.min(
    halo_lines.length + 2,
    Math.max(MIN_TILE, height - fixed - machines_rows)
  )
  let status_rows = height - fixed - machines_rows - halos_rows
  if (status_rows < MIN_TILE) {
    halos_rows += Math.max(0, status_rows)
    status_rows = 0
  }
  const right_column = [
    ...tile('HEALTH', lights, right, health_height, on),
    ...tile(machines_title, machine_lines, right, machines_rows, on),
    ...tile(
      `HALOS  ${(panels.halos?.rows ?? []).length}`,
      halo_lines,
      right,
      halos_rows,
      on
    ),
    ...tile('MODEL SPEND', model_lines, right, model_height, on),
    ...(status_rows
      ? tile(
          'STATUS',
          status_lines(panels, right - BOX_SIDES, on),
          right,
          status_rows,
          on
        )
      : [])
  ]
  return side_by_side([left_column, right_column]).slice(0, height)
}

/** Rows left for content once the top and bottom borders are drawn. */
export const body_capacity = height => Math.max(0, height - 2)

/**
 * Rounded border in the brand border color; the head sits in the top edge,
 * the footer in the bottom edge, and every body row is padded to the edge.
 * @param {object} options
 * @param {string} options.head
 * @param {string} options.footer
 * @param {string[]} options.body
 * @param {number} options.width
 * @param {boolean} options.on
 */
const box = ({ head, footer, body, width, on }) => {
  const inner = Math.max(1, width - BOX_SIDES)
  const line = text => paint(text, 'border', on)
  const edge = (left, label, right, colored = label) => {
    const room = Math.max(0, width - 5)
    const shown = width_of(label) > room ? fit(label, room) : colored
    const rest = Math.max(0, width - width_of(shown) - 5)
    return `${line(`${left}─ `)}${shown}${line(` ${'─'.repeat(rest)}${right}`)}`
  }
  return [
    edge('╭', strip_vt(head), '╮', head),
    ...body.map(row => {
      const text = clip(row, inner)
      return `${line('│')} ${text}${' '.repeat(Math.max(0, inner - width_of(text)))} ${line('│')}`
    }),
    edge('╰', footer, '╯', paint(footer, 'unknown', on))
  ]
}

/** Reads one keypress without echoing it; resolves null on any other input. */
/**
 * The next key, or 'abort' when `signal` fires first.
 * @param {NodeJS.ReadStream & { fd: 0 }} [input]
 * @param {AbortSignal | null} [signal]
 */
export const read_key = (input = process.stdin, signal = null) => {
  if (signal?.aborted) return null
  if (input.setRawMode) input.setRawMode(true)
  input.resume()
  return new Promise(resolve => {
    const done = value => {
      input.off('data', on_data)
      signal?.removeEventListener('abort', on_abort)
      resolve(value)
    }
    const on_data = chunk => done(chunk.toString('utf8'))
    const on_abort = () => done(null)
    input.on('data', on_data)
    signal?.addEventListener('abort', on_abort, { once: true })
  })
}

/** How long `key` should hold the next redraw, or null to keep the interval. */
export const interval_for = (key, current_ms) => {
  if (key === 'u') return FAST_MS
  if (key === 'm') return MS_PER_MINUTE
  if (key === 'h') return SLOW_MS
  return current_ms
}

export const people_lines = (panels, width = DEFAULT_WIDTH, on = true) => {
  const halos = panels.halos?.rows ?? []
  const running = halos.filter(h => h.state === 'running').length
  const last_report = halos.length
    ? Math.min(...halos.map(h => h.age_s ?? Infinity))
    : null
  const cost = panels.cost?.rows ?? []
  const today = cost.reduce((s, r) => s + (r.day?.cost ?? 0), 0)
  const people = running || 1
  return [
    pack(
      [
        `Active ${running}/${halos.length}`,
        last_report !== null && Number.isFinite(last_report)
          ? `${age(Math.max(0, Math.floor(last_report)))} ago`
          : 'no report',
        `today $${today.toFixed(2)} / ${running ? `person ${usd(today / people)}` : 'no people'}`
      ],
      width,
      '  '
    ),
    ...halos.map(
      row =>
        `${row.name}  ${row.actors ? `${row.actors.running} run` : '?'}  ${row.age_s === null ? 'no report' : `${age(row.age_s)} ago`}`
    )
  ].flat()
}
