import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { it } from 'node:test'
import { harness_files, merge, parse_lcov, source_files, summary, totals, untested } from '../../checks/coverage.js'

const report = files =>
  files
    .map(({ path, lines, branches = [], functions = [] }) =>
      [
        `SF:${path}`,
        ...functions.map(([name]) => `FN:1,${name}`),
        ...functions.map(([name, count]) => `FNDA:${count},${name}`),
        ...branches.map(([key, taken]) => `BRDA:${key},${taken}`),
        ...lines.map(([number, count]) => `DA:${number},${count}`),
        'end_of_record'
      ].join('\n')
    )
    .join('\n')

it('lcov paths resolve against the folder each report is relative to', () => {
  const files = parse_lcov(report([{ path: '../src/a.js', lines: [[1, 1]] }]), '/repo/frontend')
  assert.deepEqual([...files.keys()], ['/repo/src/a.js'])
})

it('totals count lines, branches, and functions, hit when run at least once', () => {
  const files = parse_lcov(
    report([
      { path: 'a.js', lines: [[1, 2], [2, 0]], branches: [['1,0,0', 1], ['1,0,1', '-']], functions: [['f', 1], ['g', 0]] }
    ]),
    '/repo'
  )
  assert.deepEqual(totals(files), { files: 1, lines: [2, 1], branches: [2, 1], functions: [2, 1] })
})

it('merging counts a shared file once and keeps any part that ran a line', () => {
  const harness = parse_lcov(report([{ path: 'shared.js', lines: [[1, 1], [2, 0]] }]), '/repo')
  const backend = parse_lcov(
    report([
      { path: 'shared.js', lines: [[1, 0], [2, 3]] },
      { path: 'only.js', lines: [[1, 0]] }
    ]),
    '/repo'
  )
  assert.deepEqual(totals(merge([harness, backend])), { files: 2, lines: [3, 2], branches: [0, 0], functions: [0, 0] })
})

it('the summary shows each part, a missing report, and the merged whole', () => {
  const files = parse_lcov(report([{ path: 'a.js', lines: [[1, 1], [2, 0]] }]), '/repo')
  const text = summary(
    [
      { name: 'harness', files, ok: true },
      { name: 'frontend', files: null, ok: false }
    ],
    files
  )
  assert.match(text, /harness\s+1\s+50\.00%\s+-\s+-\s+ok/)
  assert.match(text, /frontend\s+no report\s+FAILED/)
  assert.match(text, /all\s+1\s+50\.00%/)
})

it('source files skip tests, fixtures, configs, and types', () => {
  const listed = ['bin/a.js', 'bin/a.test.js', 'apps/realness/specs/x.js', 'apps/realness/checks/y.js', 'apps/realness/vite.config.js', 'apps/realness/src/b.vue', 'apps/realness/x.d.ts', 'apps/realness/s.sh', 'README.md'].join('\n')
  assert.deepEqual(source_files(() => listed), ['bin/a.js', 'apps/realness/src/b.vue', 'apps/realness/s.sh'])
})

it('untested files are the sources no report mentions, scripts apart from other languages', () => {
  const whole = parse_lcov(report([{ path: 'bin/a.js', lines: [[1, 1]] }]), resolve(import.meta.dirname, '../../..'))
  assert.deepEqual(untested(['bin/a.js', 'bin/b.js', 'x.sh'], whole), { scripts: ['bin/b.js'], other: ['x.sh'] })
})

it('harness coverage runs the same test globs as npm run test:harness', () => {
  assert.deepEqual(harness_files("node --test 'bin/**/*.test.js' '.pi/extensions/**/*.test.js'"), ['bin/**/*.test.js', '.pi/extensions/**/*.test.js'])
})
