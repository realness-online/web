import assert from 'node:assert/strict'
import { it } from 'node:test'
import { create_startup_trace } from '../../src/harness/startup.js'

const fixture = () => {
  let now = 0
  const events = []
  const trace = create_startup_trace({
    id: 'startup-1',
    report: event => events.push(event),
    clock: () => now
  })
  return {
    trace,
    events,
    advance: ms => {
      now += ms
    }
  }
}

it('stage durations are separate from operation elapsed time', async () => {
  const { trace, events, advance } = fixture()
  advance(10)
  const result = await trace.run('starting_actor', async () => {
    advance(40)
    return 'actor'
  })
  await trace.run('waiting_guest', async () => {
    advance(20)
  })
  assert.equal(result, 'actor')
  assert.deepEqual(events, [
    {
      startup_id: 'startup-1',
      stage: 'starting_actor',
      stage_index: 0,
      state: 'starting',
      elapsed_ms: 10
    },
    {
      startup_id: 'startup-1',
      stage: 'starting_actor',
      stage_index: 0,
      state: 'complete',
      ms: 40,
      elapsed_ms: 50
    },
    {
      startup_id: 'startup-1',
      stage: 'waiting_guest',
      stage_index: 1,
      state: 'starting',
      elapsed_ms: 50
    },
    {
      startup_id: 'startup-1',
      stage: 'waiting_guest',
      stage_index: 1,
      state: 'complete',
      ms: 20,
      elapsed_ms: 70
    }
  ])
})

it('failed work keeps its original error without storing its contents', async () => {
  const { trace, events, advance } = fixture()
  const error = new Error('private guest output')
  await assert.rejects(
    trace.run('restoring_files', async () => {
      advance(25)
      throw error
    }),
    thrown => thrown === error
  )
  assert.equal(events.at(-1).state, 'failed')
  assert.equal(events.at(-1).ms, 25)
  assert.ok(!JSON.stringify(events).includes(error.message))
})

it('nonzero guest exits can report failure without changing recovery behavior', async () => {
  const { trace, events } = fixture()
  const result = await trace.run('restoring_files', async () => ({ code: 1 }), {
    succeeded: value => value.code === 0
  })
  assert.equal(result.code, 1)
  assert.equal(events.at(-1).state, 'failed')
})

it('completion and cancellation are recorded once per stage attempt', () => {
  const { trace, events, advance } = fixture()
  const finish = trace.begin('connecting_chat')
  advance(30)
  finish('cancelled')
  finish()
  assert.equal(events.length, 2)
  assert.equal(events.at(-1).state, 'cancelled')
  const next = trace.begin('connecting_chat')
  next()
  assert.equal(events.at(-1).stage_index, 1)
})

it('unknown stages and states cannot invent progress', () => {
  const { trace, events } = fixture()
  assert.throws(
    () => trace.begin('pretending_to_start'),
    /Unknown startup stage/
  )
  assert.equal(events.length, 0)
  const finish = trace.begin('starting_actor')
  assert.throws(() => finish('maybe'), /Unknown startup state/)
  finish()
  assert.equal(events.at(-1).state, 'complete')
})
