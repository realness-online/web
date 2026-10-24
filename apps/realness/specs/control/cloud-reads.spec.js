import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  services,
  logs,
  cost,
  cloud_text
} from '../../src/control/cloud-reads.js'

const cloud = {
  project: 'realness-development',
  region: 'us-central1',
  services: ['realness-sync', 'realness-proxy'],
  billing: 'realness-development.billing.gcp_billing_export_v1_X'
}
const fake = out => {
  const calls = []
  return {
    calls,
    run: async (command, args) => (
      calls.push([command, args]),
      { ok: true, out: JSON.stringify(out), err: '' }
    )
  }
}

it('services report each configured name, missing ones too', async () => {
  const f = fake([
    {
      metadata: { name: 'realness-sync' },
      status: {
        url: 'https://s',
        latestReadyRevisionName: 'r7',
        conditions: [{ type: 'Ready', status: 'True', lastTransitionTime: 't' }]
      }
    }
  ])
  const rows = await services(cloud, f)
  assert.deepEqual(
    rows.map(r => [r.name, r.found, r.ready ?? null]),
    [
      ['realness-sync', true, true],
      ['realness-proxy', false, null]
    ]
  )
  assert.match(cloud_text.services(rows), /realness-proxy  not found/)
})

it('logs build one filter, refuse unknown services and bad flags', async () => {
  const f = fake([
    { timestamp: 't', severity: 'ERROR', textPayload: 'boom +14156667777' }
  ])
  const rows = await logs(cloud, 'realness-sync', { errors: true, run: f.run })
  assert.equal(rows[0].text, 'boom +14156667777')
  assert.match(
    f.calls[0][1][2],
    /service_name="realness-sync" AND severity>=ERROR/
  )
  await assert.rejects(logs(cloud, 'realness', { run: f.run }), /usage/)
  await assert.rejects(
    logs(cloud, 'realness-sync', { since: '1h; rm', run: f.run }),
    /--since/
  )
  await assert.rejects(
    logs(cloud, 'realness-sync', { limit: 0, run: f.run }),
    /--limit/
  )
})

it('cost needs the export, nets credits, and totals', async () => {
  await assert.rejects(
    cost({ ...cloud, billing: null }, ['realness-development']),
    /no billing export/
  )
  await assert.rejects(
    cost({ ...cloud, billing: 'x`; DROP' }, ['realness-development']),
    /project.dataset.table/
  )
  const f = fake([
    {
      project: 'realness-development',
      service: 'Cloud Run',
      currency: 'USD',
      net: '1.25'
    },
    {
      project: 'realness-online',
      service: 'Compute Engine',
      currency: 'USD',
      net: '3.5'
    }
  ])
  const found = await cost(cloud, ['realness-development', 'realness-online'], {
    days: 30,
    run: f.run
  })
  assert.equal(found.total, 4.75)
  assert.equal(f.calls.length, 2)
  assert.match(
    f.calls[0][1].at(-1),
    /INTERVAL 30 DAY[\s\S]*IN \('realness-development', 'realness-online'\)/
  )
  await assert.rejects(cost(cloud, ["x'; --"]), /bad project id/)
  const missing = async () => ({
    ok: false,
    out: 'BigQuery error: Not found: Table x was not found',
    err: ''
  })
  await assert.rejects(
    cost(cloud, ['realness-development'], { run: missing }),
    /no data yet/
  )
})

it('cost says how fresh the export is, and that zero is billed zero', async () => {
  const run = async (command, args) => ({
    ok: true,
    err: '',
    out: JSON.stringify(
      /MAX\(usage_end_time\)/.test(args.at(-1))
        ? [{ through: '2026-09-15T21:00:00Z' }]
        : []
    )
  })
  const found = await cost(cloud, ['realness-development'], { run })
  assert.deepEqual([found.total, found.through], [0, '2026-09-15T21:00:00Z'])
  assert.equal(
    cloud_text.cost(found),
    'last 7 days: 0.00 USD billed\nexport has usage through 2026-09-15 21:00 UTC'
  )
})
