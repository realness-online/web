import assert from 'node:assert/strict'
import { it } from 'node:test'
import {
  STOP_DEADLINE_MS,
  WAKE_DEADLINE_MS,
  halo_state,
  intent_now,
  lifecycle_html,
  read_lifecycle
} from '../../src/sync/halo-lifecycle.js'

const quiet_ms = 120_000
const t = iso => Date.parse(iso)
const at = '2026-10-15T12:00:00.000Z'
const life = (intent, until = '') => ({ intent, at, until, by: 'operator' })
const state = (lifecycle, checked, now) =>
  halo_state({ lifecycle, checked, now: t(now), quiet_ms })

it('an intent round-trips through its record', () => {
  const record = intent_now('starting', { now: t(at), by: 'operator' })
  assert.equal(record.until, new Date(t(at) + WAKE_DEADLINE_MS).toISOString())
  assert.deepEqual(read_lifecycle(lifecycle_html(record)), record)
  assert.equal(
    intent_now('stopping', { now: t(at) }).until,
    new Date(t(at) + STOP_DEADLINE_MS).toISOString()
  )
  assert.equal(intent_now('parked', { now: t(at) }).until, '')
})

it('unknown intents and broken records are refused', () => {
  assert.throws(() => lifecycle_html({ intent: 'asleep', at }))
  assert.equal(read_lifecycle('<p>nothing</p>'), null)
  assert.equal(
    read_lifecycle(lifecycle_html({ intent: 'parked', at: 'soon' })),
    null
  )
})

it('a parked halo with old reports is parked, never failed', () => {
  assert.equal(
    state(life('parked'), '2026-10-15T11:59:00.000Z', '2026-10-16T00:00:00Z'),
    'parked'
  )
})

it('a report after parking means the halo is up again', () => {
  assert.equal(
    state(life('parked'), '2026-10-15T12:00:30.000Z', '2026-10-15T12:01:00Z'),
    'running'
  )
})

it('stopping is stopping until its deadline, then failed', () => {
  const stopping = life('stopping', '2026-10-15T12:05:00.000Z')
  assert.equal(
    state(stopping, '2026-10-15T11:59:00.000Z', '2026-10-15T12:04:59Z'),
    'stopping'
  )
  assert.equal(
    state(stopping, '2026-10-15T11:59:00.000Z', '2026-10-15T12:05:01Z'),
    'failed'
  )
})

it('starting turns running on a fresh report, failed past the deadline', () => {
  const starting = life('starting', '2026-10-15T12:01:30.000Z')
  assert.equal(
    state(starting, '2026-10-15T11:00:00.000Z', '2026-10-15T12:01:00Z'),
    'starting'
  )
  assert.equal(
    state(starting, '2026-10-15T12:00:40.000Z', '2026-10-15T12:01:00Z'),
    'running'
  )
  assert.equal(
    state(starting, '2026-10-15T11:00:00.000Z', '2026-10-15T12:01:31Z'),
    'failed'
  )
})

it('with no intent, or running, quiet means failed', () => {
  assert.equal(
    state(null, '2026-10-15T12:00:00.000Z', '2026-10-15T12:01:00Z'),
    'running'
  )
  assert.equal(
    state(null, '2026-10-15T12:00:00.000Z', '2026-10-15T12:02:01Z'),
    'failed'
  )
  assert.equal(state(life('running'), '', '2026-10-15T12:00:01Z'), 'failed')
})
