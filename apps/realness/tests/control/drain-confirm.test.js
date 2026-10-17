/**
 * hs-n5: every actor has a home before its old halo goes.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ConfirmError,
  confirm,
  confirm_text,
  require_homes
} from '../../src/control/drain-confirm.js'

const leaving = {
  actors: [
    { id: 'a-1', state: 'running' },
    { id: 'a-2', state: 'idle' },
    { id: 'a-3', state: 'incomplete' }
  ]
}
const fleet = [
  { name: 'realness-1', actors: leaving.actors },
  { name: 'realness-2', actors: [{ id: 'a-2', state: 'running' }] }
]

test('an actor on the halo being drained must appear on another halo', () => {
  const result = confirm('realness-1', leaving, fleet)
  assert.deepEqual(result.confirmed, [{ id: 'a-2', on: 'realness-2' }])
  assert.deepEqual(result.lost, ['a-1'])
  assert.deepEqual(result.skipped, ['a-3'], 'no disk means nothing to move')
})

test('a halo with no home for an actor is refused, and names it', () => {
  assert.throws(
    () => require_homes('realness-1', leaving, fleet),
    error => {
      assert.ok(error instanceof ConfirmError)
      assert.match(
        error.message,
        /realness-1 still owns 1 actor\(s\) with no home: a-1/
      )
      return true
    }
  )
  const whole = {
    ...leaving,
    actors: leaving.actors.filter(actor => actor.id !== 'a-1')
  }
  assert.deepEqual(require_homes('realness-1', whole, fleet).lost, [])
})

test('an actor still listed on its own halo does not count as recovered', () => {
  const only_self = [
    { name: 'realness-1', actors: [{ id: 'a-1', state: 'running' }] }
  ]
  const result = confirm('realness-1', only_self[0], only_self)
  assert.deepEqual(result.lost, ['a-1'])
  assert.deepEqual(result.confirmed, [])
})

test('the summary names each confirmed actor and its halo', () => {
  const text = confirm_text('realness-1')(confirm('realness-1', leaving, fleet))
  assert.match(text, /realness-1: 1 confirmed, 1 incomplete/)
  assert.match(text, /a-2 on realness-2/)
  assert.match(text, /a-3 has no disk, not moved/)
})
