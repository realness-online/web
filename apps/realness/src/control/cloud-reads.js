import { attempt } from './exec.js'
import { ISO_DATE, ISO_MINUTE, ISO_MONTH } from '#root/lib/units.js'

const MAX_LOG_LINES = 1000
const DEFAULT_DAYS = 7
const CENTS = 100
const ROW_LIMIT = 10_000
const SEVERITY_WIDTH = 7
const MONEY_WIDTH = 9

const SINCE = /^\d+[mhd]$/

export const call = async (run, command, args) => {
  const { ok, out, err } = await run(command, args)
  if (!ok)
    throw new Error(
      `${command}: ${(err.trim() || out.trim()).replace(/\s+/g, ' ')}`
    )
  return out
}

/** Each Brayness service: URL, ready, the revision serving, when it deployed. */
export const services = async (cloud, { run = attempt } = {}) => {
  const out = await call(run, 'gcloud', [
    'run',
    'services',
    'list',
    `--project=${cloud.project}`,
    `--region=${cloud.region}`,
    '--format=json'
  ])
  const known = new Map(
    JSON.parse(out || '[]').map(service => [service.metadata.name, service])
  )
  return cloud.services.map(name => {
    const service = known.get(name)
    if (!service) return { name, found: false }
    const ready = service.status?.conditions?.find(
      condition => condition.type === 'Ready'
    )
    return {
      name,
      found: true,
      ready: ready?.status === 'True',
      url: service.status?.url ?? '',
      revision: service.status?.latestReadyRevisionName ?? '',
      deployed: ready?.lastTransitionTime ?? ''
    }
  })
}

/** Recent log lines for one service, newest first. */
/** One log entry's message, from whichever payload it carries. */
const log_line = entry => {
  if (entry.jsonPayload)
    return entry.jsonPayload.message ?? JSON.stringify(entry.jsonPayload)
  const { httpRequest: http } = entry
  return http ? `${http.requestMethod} ${http.status} ${http.requestUrl}` : ''
}

export const logs = async (
  cloud,
  name,
  { since = '1h', errors = false, limit = 50, run = attempt } = {}
) => {
  if (!cloud.services.includes(name))
    throw new Error(
      `usage: webspace <env> logs <${cloud.services.join('|')}> [--since=1h] [--errors] [--limit=50]`
    )
  if (!SINCE.test(since))
    throw new Error('--since takes a count and m, h, or d, such as 30m or 2d')
  const count = Number(limit)
  if (!Number.isInteger(count) || count < 1 || count > MAX_LOG_LINES)
    throw new Error('--limit takes 1 to 1000')
  const filter = [
    `resource.type="cloud_run_revision"`,
    `resource.labels.service_name="${name}"`,
    ...(errors ? ['severity>=ERROR'] : [])
  ].join(' AND ')
  const out = await call(run, 'gcloud', [
    'logging',
    'read',
    filter,
    `--project=${cloud.project}`,
    `--freshness=${since}`,
    `--limit=${count}`,
    '--format=json'
  ])
  return JSON.parse(out || '[]').map(entry => ({
    time: entry.timestamp,
    severity: entry.severity ?? 'DEFAULT',
    text: entry.textPayload ?? log_line(entry)
  }))
}

export const TABLE =
  /^[a-z][a-z0-9-]{4,28}[a-z0-9]\.[A-Za-z0-9_]{1,1024}\.[A-Za-z0-9_]{1,1024}$/

/** Billed cost per project and service from the billing export, net of credits. */
export const cost = async (
  cloud,
  projects,
  { days = DEFAULT_DAYS, run = attempt } = {}
) => {
  if (!cloud.billing)
    throw new Error(
      'no billing export yet: in the console, Billing > Billing export > BigQuery export, then set cloud.billing in webspace.config.js to the export table'
    )

  if (!TABLE.test(cloud.billing))
    throw new Error('cloud.billing must be project.dataset.table')
  const count = Number(days)
  if (!Number.isInteger(count) || count < 1 || count > 90)
    throw new Error('--days takes 1 to 90')
  const ids = projects.map(id => {
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id))
      throw new Error(`bad project id ${id}`)
    return `'${id}'`
  })
  const sql = `SELECT project.id AS project, service.description AS service, currency,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)), 2) AS net
FROM \`${cloud.billing}\`
WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${count} DAY)
  AND project.id IN (${ids.join(', ')})
GROUP BY project, service, currency
HAVING net != 0
ORDER BY net DESC`
  const fresh = `SELECT FORMAT_TIMESTAMP('%FT%TZ', MAX(usage_end_time)) AS through FROM \`${cloud.billing}\` WHERE project.id IN (${ids.join(', ')})`
  const query = text =>
    call(run, 'bq', [
      `--project_id=${cloud.billing.split('.')[0]}`,
      'query',
      '--use_legacy_sql=false',
      '--format=json',
      '--max_rows=200',
      text
    ]).catch(error => {
      if (/Not found: Table/.test(error.message))
        throw new Error(
          'billing export is on, but no data yet; the first rows arrive within a day'
        )
      throw error
    })
  const [out, latest] = await Promise.all([query(sql), query(fresh)])
  const rows = JSON.parse(out || '[]').map(row => ({
    ...row,
    net: Number(row.net)
  }))
  const total = rows.reduce((sum, row) => sum + row.net, 0)
  const through = JSON.parse(latest || '[]')[0]?.through ?? null
  return {
    days: count,
    currency: rows[0]?.currency ?? 'USD',
    total: Math.round(total * CENTS) / CENTS,
    through,
    rows
  }
}

/** Current invoice month, all projects in one billing export, net of credits. */
export const month_cost = async (
  cloud,
  { run = attempt, now = new Date() } = {}
) => {
  if (!cloud.billing) throw new Error('no billing export configured')
  if (!TABLE.test(cloud.billing))
    throw new Error('cloud.billing must be project.dataset.table')
  const month = now.toISOString().slice(0, ISO_MONTH)
  const sql = `SELECT project.id AS project, service.description AS service, currency,
  FORMAT_TIMESTAMP('%F', usage_start_time) AS date,
  SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS net,
  FORMAT_TIMESTAMP('%FT%TZ', MAX(usage_end_time)) AS through
FROM \`${cloud.billing}\`
WHERE invoice.month = '${month.replace('-', '')}'
GROUP BY project, service, currency, date
ORDER BY net DESC`
  const out = await call(run, 'bq', [
    `--project_id=${cloud.billing.split('.')[0]}`,
    'query',
    '--use_legacy_sql=false',
    '--format=json',
    '--maximum_bytes_billed=1000000000',
    '--max_rows=10000',
    sql
  ])
  const rows = JSON.parse(out || '[]').map(row => ({
    ...row,
    net: Number(row.net)
  }))
  if (!rows.length) throw new Error(`no exported billing data for ${month}`)
  if (rows.length >= ROW_LIMIT)
    throw new Error('billing result reached row limit; total unavailable')
  if (rows.some(row => !Number.isFinite(row.net)))
    throw new Error('billing export contains invalid costs')
  const currencies = [...new Set(rows.map(row => row.currency))]
  if (currencies.length !== 1 || currencies[0] !== 'USD')
    throw new Error('billing currency is not USD; dollar total unavailable')
  const through =
    rows
      .map(row => row.through)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null
  if (!through) throw new Error('billing export has no usage timestamp')
  const services = new Map()
  const days = new Map()
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date))
      throw new Error('billing export has no usage date')
    days.set(row.date, (days.get(row.date) ?? 0) + row.net)
    const key = JSON.stringify([row.project, row.service])
    const service = services.get(key) ?? {
      project: row.project,
      service: row.service,
      currency: row.currency,
      net: 0
    }
    service.net += row.net
    services.set(key, service)
  }
  const daily = []
  const [first] = [`${month}-01`, ...days.keys()].sort()
  const last = [...days.keys()].sort().at(-1)
  for (
    const date = new Date(`${first}T00:00:00Z`);
    date.toISOString().slice(0, ISO_DATE) <= last;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const key = date.toISOString().slice(0, ISO_DATE)
    daily.push({ date: key, cost: days.get(key) ?? 0 })
  }
  return {
    month,
    currency: 'USD',
    total: rows.reduce((sum, row) => sum + row.net, 0),
    through,
    daily,
    rows: [...services.values()].sort((a, b) => b.net - a.net),
    table: cloud.billing,
    checked: now.toISOString()
  }
}

/** Actual cloud machine and disk state, independent of agent reports. */
export const compute_inventory = async (project, { run = attempt } = {}) => {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project))
    throw new Error(`bad project id ${project}`)
  const read = async kind =>
    JSON.parse(
      await call(run, 'gcloud', [
        'compute',
        kind,
        'list',
        `--project=${project}`,
        '--format=json'
      ])
    )
  const [instances, disks] = await Promise.all([
    read('instances'),
    read('disks')
  ])
  return {
    project,
    instances: instances.map(row => ({
      name: row.name,
      status: row.status,
      zone: row.zone?.split('/').at(-1),
      machine: row.machineType?.split('/').at(-1)
    })),
    disks: disks.map(row => ({
      name: row.name,
      size_gb: Number(row.sizeGb),
      attached: (row.users ?? []).map(path => path.split('/').at(-1))
    }))
  }
}

export const cloud_text = {
  services: rows =>
    rows
      .map(s =>
        s.found
          ? `${s.name}  ${s.ready ? 'ready' : 'NOT READY'}  ${s.revision}  deployed ${s.deployed}  ${s.url}`
          : `${s.name}  not found`
      )
      .join('\n'),
  logs: rows =>
    rows.length
      ? rows
          .map(
            l => `${l.time}  ${l.severity.padEnd(SEVERITY_WIDTH)}  ${l.text}`
          )
          .join('\n')
      : 'no log lines',
  cost: c =>
    [
      `last ${c.days} days: ${c.total.toFixed(2)} ${c.currency}${c.rows.length ? '' : ' billed'}`,
      ...c.rows.map(
        r =>
          `  ${r.net.toFixed(2).padStart(MONEY_WIDTH)}  ${r.project}  ${r.service}`
      ),
      c.through
        ? `export has usage through ${c.through.slice(0, ISO_MINUTE).replace('T', ' ')} UTC`
        : 'export has no usage rows yet'
    ].join('\n')
}
