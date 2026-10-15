import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cached_read, cloud_sources } from '../../src/command/watch-cloud.js'
import { month_cost } from '#root/src/control/cloud-reads.js'
import { health_snapshot } from '../../src/command/watch-health.js'

const billing = 'realness-development.billing.export'
const cloud = {
  billing,
  project: 'realness-development',
  region: 'us-central1',
  services: ['realness-sync']
}
const row = {
  date: '2026-10-11',
  net: '5.473',
  currency: 'USD',
  project: 'another-project',
  service: 'Firebase Hosting',
  through: '2026-10-11T10:00:00Z'
}
const now = new Date('2026-10-11T12:00:00Z')

test('invoice-month billing includes every project and nets credits without rounding rows', async () => {
  const calls = []
  const found = await month_cost(cloud, {
    now,
    run: async (command, args) => {
      calls.push([command, args])
      return { ok: true, out: JSON.stringify([row]), err: '' }
    }
  })
  assert.equal(found.total, 5.473)
  assert.equal(found.through, row.through)
  assert.equal(found.month, '2026-10')
  assert.equal(found.daily.length, 11)
  assert.equal(found.daily.at(-1).cost, 5.473)
  assert.equal(found.daily[0].cost, 0)
  assert.match(calls[0][1].at(-1), /GROUP BY project, service, currency, date/)
  assert.equal(calls.length, 1)
  const sql = calls[0][1].at(-1)
  assert.match(sql, /invoice.month = '202610'/)
  assert.match(sql, /UNNEST\(credits\)/)
  assert.ok(!sql.includes('project.id IN'))
  assert.ok(!sql.includes('ROUND'))
})

test('empty, failed, invalid and mixed-currency exports are unavailable', async () => {
  for (const rows of [
    [],
    [{ ...row, net: 'bad' }],
    [{ ...row, through: null }],
    [{ ...row, currency: 'EUR' }]
  ]) {
    await assert.rejects(
      month_cost(cloud, {
        now,
        run: async () => ({ ok: true, out: JSON.stringify(rows), err: '' })
      })
    )
  }
  await assert.rejects(
    month_cost(cloud, {
      now,
      run: async () => ({ ok: false, out: '', err: 'permission denied' })
    }),
    /permission denied/
  )
})

test('cache shares in-flight reads, including failures, until expiry', async () => {
  let time = 0
  let reads = 0
  const read = cached_read(
    async () => {
      reads++
      throw new Error('offline')
    },
    100,
    () => time
  )
  await Promise.allSettled([read(), read()])
  assert.equal(reads, 1)
  time = 99
  await assert.rejects(read(), /offline/)
  assert.equal(reads, 1)
  time = 100
  await assert.rejects(read(), /offline/)
  assert.equal(reads, 2)
})

test('sources deduplicate exports and query billing more slowly than services', async () => {
  let time = now.getTime()
  const calls = []
  const sources = cloud_sources({
    environments: { local: { cloud }, development: { cloud } },
    now: () => time,
    run: async (command, args, options) => {
      calls.push(command)
      assert.equal(options.timeout, 60_000)
      return {
        ok: true,
        out: JSON.stringify(command === 'bq' ? [row] : []),
        err: ''
      }
    }
  })
  assert.equal((await sources.billing()).exports.length, 1)
  await sources.services()
  await sources.billing()
  time += 5 * 60_000
  await sources.services()
  await sources.billing()
  assert.deepEqual(calls, ['bq', 'gcloud', 'gcloud'])
  time += 10 * 60_000
  await sources.billing()
  assert.equal(calls.filter(command => command === 'bq').length, 2)
})

test('inventory reads real machine power state and retained disks across billed projects', async () => {
  const projects = []
  const sources = cloud_sources({
    environments: { local: { cloud } },
    now: () => now.getTime(),
    run: async (command, args) => {
      const out =
        command === 'bq'
          ? [row]
          : args[1] === 'instances'
            ? [
                {
                  name: 'chat-ui',
                  status: 'RUNNING',
                  machineType: 'zones/z/machineTypes/n2-standard-4',
                  zone: 'zones/z'
                }
              ]
            : [{ name: 'boot', sizeGb: '20', users: [] }]
      if (command === 'gcloud')
        projects.push(args.find(arg => arg.startsWith('--project=')))
      return { ok: true, out: JSON.stringify(out), err: '' }
    }
  })
  const resources = await sources.resources()
  assert.deepEqual([...new Set(projects)].sort(), [
    '--project=another-project',
    '--project=realness-development'
  ])
  assert.equal(resources.inventories[0].instances[0].status, 'RUNNING')
  assert.equal(resources.inventories[0].disks[0].size_gb, 20)
  const snapshot = await health_snapshot({
    store: { ls: async () => [] },
    cloud: sources
  })
  assert.equal(snapshot.panels.resources.status, 'ok')
})

test('daily charges sum to the invoice total and service totals', async () => {
  const rows = [
    { ...row, date: '2026-10-10', net: '2' },
    { ...row, date: '2026-10-11', net: '3' },
    { ...row, service: 'Compute Engine', net: '4' }
  ]
  const found = await month_cost(cloud, {
    now,
    run: async () => ({ ok: true, out: JSON.stringify(rows), err: '' })
  })
  assert.equal(found.total, 9)
  assert.equal(
    found.daily.reduce((sum, day) => sum + day.cost, 0),
    9
  )
  assert.equal(
    found.rows.find(row => row.service === 'Firebase Hosting').net,
    5
  )
})

test('cloud read failures leave local health usable', async () => {
  const snapshot = await health_snapshot({
    store: { ls: async () => [] },
    cloud: {
      billing: async () => {
        throw new Error('billing permission denied')
      },
      services: async () => ({ rows: [] })
    }
  })
  assert.equal(snapshot.panels.billing.status, 'failed')
  assert.equal(snapshot.panels.services.status, 'ok')
  assert.equal(snapshot.panels.sign_on.status, 'ok')
})
