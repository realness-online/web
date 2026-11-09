import { it } from 'node:test'
import assert from 'node:assert/strict'
import { approved, gate_lines, nodes_in } from '../../lib/plan-gates.js'

it('only a fixed Gate 1 line approves a plan', () => {
  assert.equal(approved('### Decisions\n\n- Gate 1: approved'), true)
  assert.equal(approved('- Gate 1: approve review scope'), false)
  assert.equal(approved('Writes `- Gate 1: approved` as an example'), false)
  assert.deepEqual(
    gate_lines('- Gate 2: held\n- Gate 2: reshaped a1, b2\n- Gate 2: fine').map(({ ok }) => ok),
    [true, true, false]
  )
  assert.equal(approved('- Gate 1: pending'), false)
  assert.equal(approved('- Gate 1: not approved'), false)
  assert.equal(gate_lines('- Gate 1: pending')[0].ok, true)
})

it('nodes are read from mermaid class lines', () => {
  const dag = '  class G4 gate;\n  class b1d blocked;\n  class a1,b2 active;\n  class c3 done;'
  assert.deepEqual(nodes_in(dag, 'active'), ['a1', 'b2'])
  assert.deepEqual(nodes_in(dag, 'done'), ['c3'])
})
