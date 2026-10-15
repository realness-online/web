/**
 * hs-mem: the measurement says what a host must hold and what an actor uses.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MemoryError, measure, memory_text } from '../../src/control/memory.js'

const stages = [
  { name: 'created', run: '' },
  { name: 'pi running', run: 'true' }
]

const fixture = readings => {
  const ran = []
  let index = 0
  return {
    ran,
    actor: 'a-111111111111',
    stages,
    run: async argv => ran.push(argv.join(' ')),
    sample: async actor => {
      ran.push(`sample ${actor}`)
      return readings[Math.min(index++, readings.length - 1)]
    }
  }
}

test('each stage is run and then measured', async () => {
  const one = fixture([
    { host_mib: 140, guest_used_mib: 50, top: ['36M MainThread'] },
    { host_mib: 233, guest_used_mib: 104, top: ['106M pi'] }
  ])
  const result = await measure(one)
  assert.deepEqual(
    result.rows.map(row => row.stage),
    ['created', 'pi running']
  )
  assert.equal(result.peak, 233, 'the host must hold the largest it gave up')
  assert.equal(
    result.floor_mib,
    128,
    'the guest used 104, rounded up to a step'
  )
  assert.deepEqual(one.ran, [
    'sample a-111111111111',
    'true',
    'sample a-111111111111'
  ])
})

test('a stage that needs no command is still measured', async () => {
  const one = fixture([{ host_mib: 100, guest_used_mib: 10, top: [] }])
  await measure({ ...one, stages: [{ name: 'created', run: '' }] })
  assert.deepEqual(one.ran, ['sample a-111111111111'])
})

test('the floor rounds up in whole steps, and never below what was used', async () => {
  const one = fixture([
    { host_mib: 400, guest_used_mib: 65, top: [] },
    { host_mib: 500, guest_used_mib: 96, top: [] }
  ])
  const result = await measure(one)
  assert.equal(result.floor_mib, 128)
  assert.ok(result.floor_mib >= 96)
  assert.equal(result.peak, 500)
})

test('the summary names the peak, the floor, and the biggest process', async () => {
  const one = fixture([
    {
      host_mib: 140,
      guest_used_mib: 50,
      top: ['36M MainThread', '11M systemd']
    }
  ])
  const text = memory_text(await measure(one))
  assert.match(text, /peak host 140 MiB, floor 64 MiB/)
  assert.match(
    text,
    /created: host 140 MiB, guest 50 MiB \(36M MainThread, 11M systemd\)/
  )
})

test('a missing actor or no stages is refused', async () => {
  const one = fixture([{ host_mib: 1, guest_used_mib: 1, top: [] }])
  await assert.rejects(measure({ ...one, actor: '' }), MemoryError)
  await assert.rejects(
    measure({ ...one, stages: [] }),
    /needs at least one stage/
  )
  assert.deepEqual(one.ran, [])
})
