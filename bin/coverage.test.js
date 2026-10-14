import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lcov_totals, summary } from './coverage.js'

test('lcov totals add every file in a report', () => {
  const report = 'SF:a.js\nFNF:2\nFNH:1\nBRF:4\nBRH:3\nLF:10\nLH:8\nend_of_record\nSF:b.js\nFNF:2\nFNH:2\nBRF:0\nBRH:0\nLF:10\nLH:10\nend_of_record\n'
  assert.deepEqual(lcov_totals(report), { lines: [20, 18], branches: [4, 3], functions: [4, 3] })
})

test('the summary weighs parts by size and marks failures', () => {
  const text = summary([
    { name: 'small', totals: { lines: [10, 10], branches: [0, 0], functions: [1, 1] }, ok: true },
    { name: 'large', totals: { lines: [90, 45], branches: [10, 5], functions: [9, 0] }, ok: false },
    { name: 'gone', totals: null, ok: false }
  ])
  assert.match(text, /small\s+100\.00%\s+-\s+100\.00%\s+ok/)
  assert.match(text, /large\s+50\.00%\s+50\.00%\s+0\.00%\s+FAILED/)
  assert.match(text, /gone\s+no report\s+FAILED/)
  assert.match(text, /all\s+55\.00%\s+50\.00%\s+10\.00%/)
})
