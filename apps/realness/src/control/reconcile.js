import { attempt } from './exec.js'
import * as reads from './reads.js'
import { month_days } from '#root/src/proxy/usage.js'
import { TABLE, call } from './cloud-reads.js'
import { HTTP } from '#root/lib/http.js'
import { ISO_DATE, MS_PER_DAY } from '#root/lib/units.js'

const MONEY_PLACES = 4
const BILL_DAYS = 14
const EXTRA_DAYS = 7

const OPENROUTER = 'https://openrouter.ai/api/v1'
/** Differences smaller than this are rounding or a call still landing. */
export const TOLERANCE = { cost: 0.01, share: 0.01 }

/** A secret from the environment's own project. */
export const read_secret = async (project, name, { run = attempt } = {}) => {
  const { ok, out } = await run('gcloud', [
    'secrets',
    'versions',
    'access',
    'latest',
    `--secret=${name}`,
    `--project=${project}`
  ])
  const value = ok ? out.trim() : ''
  if (!value) throw new Error(`no secret ${name} in ${project}`)
  return value
}

/** What OpenRouter says the key spent: today and this month. */
export const key_totals = async (key, fetcher = fetch) => {
  const response = await fetcher(`${OPENROUTER}/key`, {
    headers: { authorization: `Bearer ${key}` }
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(
      `openrouter key: ${body?.error?.message ?? response.status}`
    )
  const data = body.data ?? {}
  return {
    day: Number(data.usage_daily ?? 0),
    month: Number(data.usage_monthly ?? 0),
    label: data.label ?? ''
  }
}

/** The ledger's cost for this UTC month, and today, across everyone. */
export const ledger_totals = async (sync, now = Date.now()) => {
  const days = month_days(new Date(now))
  const phones = (
    await sync.ls('can://usage/').catch(error => {
      if (error.status === HTTP.NOT_FOUND) return []
      throw error
    })
  )
    .filter(name => name.endsWith('/'))
    .map(name => name.slice(0, -1))
  const costs = await Promise.all(
    phones.flatMap(phone =>
      days.map(async day => [day, (await reads.usage(sync, phone, day)).cost])
    )
  )
  const today = days.at(-1)
  return {
    day: costs
      .filter(([day]) => day === today)
      .reduce((n, [, cost]) => n + cost, 0),
    month: costs.reduce((n, [, cost]) => n + cost, 0)
  }
}

/** Apart by more than a cent and more than 1%. */
export const apart = (a, b) => {
  const gap = Math.abs(a - b)
  return gap > TOLERANCE.cost && gap > TOLERANCE.share * Math.max(a, b)
}

/** Today and this month: the ledger against OpenRouter for the proxy's key. */
export const reconcile_models = async (
  sync,
  config,
  { now = Date.now(), run = attempt, fetcher = fetch } = {}
) => {
  const openrouter = config.cloud?.openrouter
  if (!openrouter) throw new Error('no cloud.openrouter in webspace.config.js')
  const key = await read_secret(config.cloud.project, openrouter.key_secret, {
    run
  })
  const [theirs, ours] = await Promise.all([
    key_totals(key, fetcher),
    ledger_totals(sync, now)
  ])
  const gaps = ['day', 'month']
    .filter(span => apart(ours[span], theirs[span]))
    .map(span => ({ span, ledger: ours[span], openrouter: theirs[span] }))
  return {
    checked: new Date(now).toISOString(),
    key: theirs.label,
    ledger: ours,
    openrouter: { day: theirs.day, month: theirs.month },
    gaps
  }
}

const money = n => `$${n.toFixed(MONEY_PLACES)}`
export const reconcile_text = r =>
  [
    `models today: ledger ${money(r.ledger.day)}, openrouter ${money(r.openrouter.day)}`,
    `models this month: ledger ${money(r.ledger.month)}, openrouter ${money(r.openrouter.month)}`,
    r.gaps.length
      ? r.gaps
          .map(
            g =>
              `  ! ${g.span}: openrouter is ${money(g.openrouter - g.ledger)} ${g.openrouter > g.ledger ? 'over' : 'under'} the ledger`
          )
          .join('\n')
      : '  matches'
  ].join('\n')

export const CLOUD = { baseline_days: 7, spike_ratio: 2, spike_floor: 1 }

/** Daily net cost per service from the export, for the last `days` days. */
export const bill_days = async (
  cloud,
  { days = BILL_DAYS, run = attempt } = {}
) => {
  if (!cloud.billing)
    throw new Error('no billing export for this environment; set cloud.billing')
  if (!TABLE.test(cloud.billing))
    throw new Error('cloud.billing must be project.dataset.table')
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(cloud.project))
    throw new Error('bad project id')
  const sql = `SELECT FORMAT_DATE('%F', DATE(usage_start_time)) AS day, service.description AS service,
  SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS net
FROM \`${cloud.billing}\`
WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${Number(days)} DAY)
  AND project.id = '${cloud.project}'
GROUP BY day, service`
  const out = await call(run, 'bq', [
    `--project_id=${cloud.billing.split('.')[0]}`,
    'query',
    '--use_legacy_sql=false',
    '--format=json',
    '--max_rows=10000',
    sql
  ])
  return JSON.parse(out || '[]').map(row => ({
    day: row.day,
    service: row.service,
    net: Number(row.net)
  }))
}

const day_before = (day, n) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - n * MS_PER_DAY)
    .toISOString()
    .slice(0, ISO_DATE)

/** The checks, over rows from bill_days. Pure, so tests plant gaps directly. */
export const check_bill = (rows, expected = [], limits = CLOUD) => {
  const latest = rows.reduce((max, row) => (row.day > max ? row.day : max), '')
  if (!latest) return { latest: null, total: 0, baseline: 0, gaps: [] }
  const total_on = day =>
    rows.filter(row => row.day === day).reduce((n, row) => n + row.net, 0)
  const baseline =
    Array.from({ length: limits.baseline_days }, (_, i) =>
      total_on(day_before(latest, i + 1))
    ).reduce((a, b) => a + b, 0) / limits.baseline_days
  const total = total_on(latest)
  const gaps = []
  const unexpected = new Map()
  for (const row of rows)
    if (row.net > 0 && !expected.includes(row.service))
      unexpected.set(row.service, (unexpected.get(row.service) ?? 0) + row.net)
  for (const [service, net] of unexpected)
    gaps.push({ kind: 'unexpected', service, net })
  if (total > limits.spike_floor && total > limits.spike_ratio * baseline)
    gaps.push({ kind: 'spike', day: latest, net: total, baseline })
  return { latest, total, baseline, gaps }
}

/** The GCP side of o8 for one environment. */
export const reconcile_cloud = async (config, { run = attempt } = {}) => {
  const rows = await bill_days(config.cloud, {
    days: CLOUD.baseline_days + EXTRA_DAYS,
    run
  })
  return check_bill(rows, config.cloud.expected ?? [], {
    ...CLOUD,
    ...config.cloud.spike
  })
}

export const cloud_text = c =>
  [
    c.latest
      ? `gcp ${c.latest}: $${c.total.toFixed(2)} (7-day average $${c.baseline.toFixed(2)})`
      : 'gcp: no bill rows in the last two weeks',
    ...c.gaps.map(g =>
      g.kind === 'spike'
        ? `  ! spike: $${g.net.toFixed(2)} on ${g.day}, over ${CLOUD.spike_ratio}x the average`
        : `  ! unexpected service: ${g.service}, $${g.net.toFixed(2)}`
    ),
    ...(c.latest && !c.gaps.length ? ['  matches'] : [])
  ].join('\n')
