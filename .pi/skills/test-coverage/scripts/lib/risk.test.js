import { it } from 'node:test'
import assert from 'node:assert/strict'
import { actionable_target, product_priority, risk_score } from './risk.js'

const plain = { path: 'src/other.js', pct: 80, threshold: 80, has_spec: true }

it('an unused file ranks below everything', () => {
  assert.equal(risk_score({ ...plain, unused: true, pct: 0 }), -1)
})

it('a covered, specced, ordinary file with no findings scores zero', () => {
  assert.equal(risk_score(plain), 0)
})

it('each signal adds its own weight', () => {
  const each = [
    [{ pct: 70 }, 12],
    [{ scores: { crap_max: 100 } }, 35],
    [{ scores: { crap_above_threshold: 2 } }, 16],
    [{ scores: { fan_in: 4 } }, 6],
    [{ hotspot: { score: 10 } }, 4],
    [{ target: { priority: 20 } }, 5],
    [{ complexity: { count: 3 } }, 6],
    [{ has_spec: false }, 10]
  ]
  for (const [change, weight] of each) assert.equal(risk_score({ ...plain, ...change }), weight, JSON.stringify(change))
})

it('coverage above the gate and CRAP above 120 add nothing more', () => {
  assert.equal(risk_score({ ...plain, pct: 95 }), 0)
  assert.equal(risk_score({ ...plain, scores: { crap_max: 500 } }), 42)
})

it('product priority adds 15 for P0 and 8 for P1', () => {
  assert.equal(risk_score({ ...plain, path: 'src/app/use/sync.js' }), 15)
  assert.equal(risk_score({ ...plain, path: 'src/views/Home.vue' }), 8)
})

it('product priority reads app paths as if src/app were src', () => {
  assert.equal(product_priority('src/app/persistence/store.js'), 'P0')
  assert.equal(product_priority('src/potrace/trace.js'), 'P1')
  assert.equal(product_priority('src/halo/actors.js'), 'P2')
})

it('a target ranked only by its importers is not actionable', () => {
  assert.equal(actionable_target({ path: 'src/halo/log.js', category: 'split_high_impact' }), false)
  assert.equal(actionable_target({ path: 'src/halo/door.js', category: 'extract_complex_functions' }), true)
  assert.equal(actionable_target({ path: 'specs/a.spec.js', category: 'add_test_coverage' }), false)
})
