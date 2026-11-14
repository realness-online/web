import assert from 'node:assert/strict'
import { it } from 'node:test'
import { kind_of, pi_stages } from '../../src/scouts/stages.js'

const at = seconds => 1794000000000 + seconds * 1000

it('a read tool reads, a chrome tool leases, and everything else scores', () => {
  assert.equal(kind_of({ tool: 'realness-read --site yc --brief x' }), 'read')
  assert.equal(kind_of({ tool: '.pi/bin/web/realness-read https://x' }), 'read')
  assert.equal(kind_of({ tool: 'realness-chrome' }), 'lease')
  assert.equal(kind_of({ tool: 'agent-browser open https://x' }), 'lease')
  assert.equal(kind_of({ tool: 'bash jq . finds.html' }), 'score')
  assert.equal(kind_of({}), 'score')
})

it('neighbouring records of one kind are one stage, and a stage runs to the next', () => {
  const stages = pi_stages(
    [
      { at: at(0), tool: '' },
      { at: at(2), tool: 'realness-read --site yc' },
      { at: at(5), tool: 'realness-read --site yc --brief y' },
      { at: at(9), tool: '' },
      { at: at(12), tool: 'realness-chrome' }
    ],
    at(20)
  )
  assert.deepEqual(
    stages.map(one => [one.name, one.started, one.ended]),
    [
      ['score', '2026-11-06T21:20:00.000Z', '2026-11-06T21:20:02.000Z'],
      ['read', '2026-11-06T21:20:02.000Z', '2026-11-06T21:20:09.000Z'],
      ['score', '2026-11-06T21:20:09.000Z', '2026-11-06T21:20:12.000Z'],
      ['lease', '2026-11-06T21:20:12.000Z', '2026-11-06T21:20:20.000Z']
    ]
  )
})

it('a run that left no records has no stages', () => {
  assert.deepEqual(pi_stages([]), [])
})

it('a stage is work, so a run counts it as time worked, not waited', () => {
  assert.equal(pi_stages([{ at: at(0), tool: '' }], at(3))[0].kind, 'work')
})
