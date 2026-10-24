/**
 * hs-d1: the choice names its binding limit and shows the arithmetic.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { mkdir, mkdtemp, writeFile as write_file } from 'node:fs/promises'
import { execFile as exec_file } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { join } from 'node:path'
import {
  ACTOR_TAPS,
  BUDGET_USD,
  ScaleError,
  scale_choice,
  scale_text
} from '../../src/control/scale.js'

/* A price that leaves room for a second halo inside the ceiling. */
const price = 0.06

it('one halo holds the demand, so no second halo earns its bill', () => {
  const choice = scale_choice({
    actors_per_halo: 34,
    hourly_cost: price,
    demand: 20
  })
  assert.equal(choice.halos, 1)
  assert.equal(choice.binding, 'none today')
  assert.match(choice.choice, /^one halo/)
  assert.match(choice.because[0], /20 actors \/ 34 per halo = 1 halo\(s\)/)
  assert.match(choice.because[1], /ceiling \$100/)
})

it('demand past one halo names memory as what binds', () => {
  const choice = scale_choice({
    actors_per_halo: 34,
    hourly_cost: price,
    demand: 60
  })
  assert.equal(choice.halos, 2)
  assert.equal(choice.binding, 'memory')
  assert.match(choice.choice, /^2 halos: 60 actors/)
  assert.ok(
    choice.monthly_usd < BUDGET_USD,
    'two halos are still inside the ceiling'
  )
})

it('a price that breaks the ceiling names budget instead', () => {
  const choice = scale_choice({
    actors_per_halo: 34,
    hourly_cost: 0.5,
    demand: 30
  })
  assert.equal(choice.halos, 1)
  assert.equal(choice.binding, 'budget')
  assert.equal(choice.budget_room_halos, Math.floor(BUDGET_USD / (0.5 * 730)))
  assert.match(choice.because[1], /ceiling \$100/)
})

it('demand inside one halo, close to the tap ceiling, names addresses', () => {
  const nearly_full = scale_choice({
    actors_per_halo: 250,
    hourly_cost: price,
    demand: 250
  })
  assert.equal(nearly_full.halos, 1)
  assert.equal(nearly_full.binding, 'addresses')
  assert.ok(
    nearly_full.budget_room_halos >= 1,
    'the price still fits the ceiling'
  )
  assert.match(
    scale_text(nearly_full),
    /254 TAPs is per halo: more actors need another halo, not a bigger one/
  )
})

it('more actors than one halo can address is refused outright', () => {
  assert.throws(
    () =>
      scale_choice({
        actors_per_halo: 200,
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

it('an unmeasured actor count or price is refused', () => {
  assert.throws(
    () => scale_choice({ actors_per_halo: 0, hourly_cost: price }),
    /measured actor count/
  )
  assert.throws(
    () => scale_choice({ actors_per_halo: 34, hourly_cost: 0 }),
    /hourly price/
  )
})

it('parked halos use explicit monthly running hours for compute cost', () => {
  const choice = scale_choice({
    actors_per_halo: 34,
    hourly_cost: 0.5,
    demand: 30,
    monthly_hours: 100
  })
  assert.equal(choice.monthly_usd, 50)
  assert.equal(choice.monthly_hours, 100)
  assert.equal(choice.budget_room_halos, 2)
  assert.equal(choice.binding, 'none today')
  assert.match(scale_text(choice), /100 hours per halo/)
  assert.match(scale_text(choice), /compute only/)
  assert.equal(
    scale_choice({ actors_per_halo: 34, hourly_cost: price }).monthly_hours,
    730
  )
})

it('public scale command reads monthly hours from its report and accepts an override', async () => {
  const root = file_url_to_path(
    new URL('../../../../artifacts/realness/quality/', import.meta.url)
  )
  await mkdir(root, { recursive: true })
  const directory = await mkdtemp(join(root, 'scale-cli-'))
  const report = join(directory, 'report.json')
  await write_file(
    report,
    JSON.stringify({
      actors_per_halo: 34,
      hourly_cost: 0.5,
      monthly_hours: 100
    })
  )
  const command = file_url_to_path(
    new URL('../../tools/cli/bin/realness.js', import.meta.url)
  )
  const execute = promisify(exec_file)
  const args = [
    command,
    'development',
    'halo',
    'scale',
    `--report=${report}`,
    '--json'
  ]
  const from_report = await execute(process.execPath, args)
  assert.equal(JSON.parse(from_report.stdout).monthly_usd, 50)
  const overridden = await execute(process.execPath, [
    ...args,
    '--monthly-hours=50'
  ])
  assert.equal(JSON.parse(overridden.stdout).monthly_usd, 25)
  await assert.rejects(
    execute(process.execPath, [...args, '--monthly-hours=0']),
    error => {
      assert.match(JSON.parse(error.stdout).error, /monthly hours/)
      return true
    }
  )
})

it('invalid monthly running hours are refused', () => {
  for (const monthly_hours of [0, -1, NaN, Infinity, 731])
    assert.throws(
      () =>
        scale_choice({
          actors_per_halo: 34,
          hourly_cost: price,
          monthly_hours
        }),
      /monthly hours/
    )
})

it('demand defaults to what one halo holds, which is always one halo', () => {
  const choice = scale_choice({ actors_per_halo: 40, hourly_cost: price })
  assert.equal(choice.demand, 40)
  assert.equal(choice.halos, 1)
})
