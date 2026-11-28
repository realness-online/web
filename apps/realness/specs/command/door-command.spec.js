/**
 * `realness door` runs the same check a turn runs: it reads the hash pages and
 * opens only what moved.
 */
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { run_door } from '#root/src/command/door-command.js'

const output = () => {
  const lines = []
  return { lines, stdout: { write: text => lines.push(text) } }
}

it('prints what the turn check moved', async () => {
  const out = output()
  const calls = []
  const code = await run_door([], {
    stdout: out.stdout,
    root: '/r',
    phone: '+15555550100',
    store: {},
    turn: async options => (calls.push(options), 'Sync: 3 arrived, 1 wait')
  })
  assert.equal(code, 0)
  assert.equal(calls[0].phone, '+15555550100')
  assert.deepEqual(out.lines, ['Sync: 3 arrived, 1 wait\n'])
})

it('says so when nothing moved', async () => {
  const out = output()
  await run_door([], {
    stdout: out.stdout,
    root: '/r',
    phone: '+15555550100',
    store: {},
    turn: async () => null
  })
  assert.deepEqual(out.lines, ['door: nothing changed\n'])
})
