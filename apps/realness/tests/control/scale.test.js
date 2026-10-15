/**
 * hs-d1: the choice names its binding limit and shows the arithmetic.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ACTOR_TAPS,
  BUDGET_USD,
  ScaleError,
  scale_choice,
  scale_text
} from '../../src/control/scale.js'

/* A price that leaves room for a second host inside the ceiling. */
const price = 0.06

test('one host holds the demand, so no second host earns its bill', () => {
  const choice = scale_choice({
    actors_per_host: 34,
    hourly_cost: price,
    demand: 20
  })
  assert.equal(choice.hosts, 1)
  assert.equal(choice.binding, 'none today')
  assert.match(choice.choice, /^one host/)
  assert.match(choice.because[0], /20 actors \/ 34 per host = 1 host\(s\)/)
  assert.match(choice.because[1], /ceiling \$100/)
})

test('demand past one host names memory as what binds', () => {
  const choice = scale_choice({
    actors_per_host: 34,
    hourly_cost: price,
    demand: 60
  })
  assert.equal(choice.hosts, 2)
  assert.equal(choice.binding, 'memory')
  assert.match(choice.choice, /^2 hosts: 60 actors/)
  assert.ok(
    choice.monthly_usd < BUDGET_USD,
    'two hosts are still inside the ceiling'
  )
})

test('a price that breaks the ceiling names budget instead', () => {
  const choice = scale_choice({
    actors_per_host: 34,
    hourly_cost: 0.5,
    demand: 30
  })
  assert.equal(choice.hosts, 1)
  assert.equal(choice.binding, 'budget')
  assert.equal(choice.budget_room_hosts, Math.floor(BUDGET_USD / (0.5 * 730)))
  assert.match(choice.because[1], /ceiling \$100/)
})

test('demand inside one host, close to the tap ceiling, names addresses', () => {
  const nearly_full = scale_choice({
    actors_per_host: 250,
    hourly_cost: price,
    demand: 250
  })
  assert.equal(nearly_full.hosts, 1)
  assert.equal(nearly_full.binding, 'addresses')
  assert.ok(
    nearly_full.budget_room_hosts >= 1,
    'the price still fits the ceiling'
  )
  assert.match(
    scale_text(nearly_full),
    /254 TAPs is per host: more actors need another host, not a bigger one/
  )
})

test('more actors than one host can address is refused outright', () => {
  assert.throws(
    () =>
      scale_choice({
        actors_per_host: 200,
        hourly_cost: price,
        demand: ACTOR_TAPS + 1
      }),
    error => {
      assert.ok(error instanceof ScaleError)
      assert.match(error.message, /cannot address 255 actors/)
      return true
    }
  )
})

test('an unmeasured actor count or price is refused', () => {
  assert.throws(
    () => scale_choice({ actors_per_host: 0, hourly_cost: price }),
    /measured actor count/
  )
  assert.throws(
    () => scale_choice({ actors_per_host: 34, hourly_cost: 0 }),
    /hourly price/
  )
})

test('demand defaults to what one host holds, which is always one host', () => {
  const choice = scale_choice({ actors_per_host: 40, hourly_cost: price })
  assert.equal(choice.demand, 40)
  assert.equal(choice.hosts, 1)
})
