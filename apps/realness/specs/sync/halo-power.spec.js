import { it } from 'node:test'
import assert from 'node:assert/strict'
import {
  gce_statuses,
  power_cause,
  with_causes
} from '#root/src/sync/halo-power.js'
import { halo_alerts } from '#root/src/sync/halo-alerts.js'

it('a powered-off halo and a running, silent halo read differently', () => {
  assert.equal(power_cause('TERMINATED'), 'off')
  assert.equal(power_cause('SUSPENDED'), 'off')
  assert.equal(power_cause('MISSING'), 'off')
  assert.equal(power_cause('RUNNING'), 'frozen')
  assert.equal(power_cause('REPAIRING'), 'unknown')
  assert.equal(power_cause(undefined), 'unknown')
})

it('one listing labels every failed halo; a deleted halo is off', async () => {
  const statuses = async () =>
    new Map([
      ['a', 'RUNNING'],
      ['b', 'TERMINATED']
    ])
  assert.deepEqual(
    await with_causes([{ name: 'a' }, { name: 'b' }, { name: 'c' }], statuses),
    [
      { name: 'a', cause: 'frozen' },
      { name: 'b', cause: 'off' },
      { name: 'c', cause: 'off' }
    ]
  )
})

it('a refused listing never guesses; no provider never asks', async () => {
  let asked = 0
  const refused = async () => {
    asked += 1
    throw new Error('403')
  }
  assert.deepEqual(await with_causes([{ name: 'a' }], refused), [
    { name: 'a', cause: 'unknown' }
  ])
  assert.deepEqual(await with_causes([], refused), [])
  assert.equal(asked, 1)
  assert.deepEqual(await with_causes([{ name: 'a' }], null), [
    { name: 'a', cause: 'unknown' }
  ])
})

it('the listing reads instance names and statuses across zones', async () => {
  const seen = []
  const fetcher = async (url, init) => {
    seen.push({ url, auth: init.headers.authorization })
    return new Response(
      JSON.stringify({
        items: {
          'zones/us-west1-b': {
            instances: [{ name: 'h1', status: 'RUNNING' }]
          },
          'zones/us-east1-c': {},
          'zones/us-central1-a': {
            instances: [{ name: 'h2', status: 'STOPPED' }]
          }
        }
      })
    )
  }
  const statuses = await gce_statuses({
    project: 'p',
    token: async () => 't',
    fetcher
  })()
  assert.deepEqual(
    [...statuses],
    [
      ['h1', 'RUNNING'],
      ['h2', 'STOPPED']
    ]
  )
  assert.match(seen[0].url, /projects\/p\/aggregated\/instances/)
  assert.equal(seen[0].auth, 'Bearer t')
  await assert.rejects(
    gce_statuses({
      project: 'p',
      token: async () => 't',
      fetcher: async () => new Response('', { status: 403 })
    })(),
    /403/
  )
})

it('the alert says which kind of quiet it is', () => {
  const [down] = halo_alerts({}, [{ name: 'h1', cause: 'off' }], 1000)
  assert.equal(down.text, 'realness halo h1 stopped reporting: powered off')
  const [plain] = halo_alerts({}, [{ name: 'h1' }], 1000)
  assert.equal(plain.text, 'realness halo h1 stopped reporting')
})
