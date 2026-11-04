#!/usr/bin/env node
/**
 * Merge Vitest coverage + fallow health for test-first refactor planning.
 *
 * Usage (from project root, after test:coverage and npx fallow):
 *   node path/to/prioritize-refactor-risk.js --root .
 *
 * Options:
 *   --threshold 80     coverage % gate (min of stmt/branch/fn/line)
 *   --top 25           rows per section
 *   --coverage-only    skip fallow-report.json (coverage signals only)
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { coverage_args, load_coverage_by_src } from './lib/coverage-metrics.js'
import { actionable_target, product_priority, risk_score } from './lib/risk.js'

const args = coverage_args(25)

const project_root = args.root
const threshold = args.threshold
const top_n = args.top
const coverage_only = args['coverage-only']

const fallow_path = args.fallow ?? join(project_root, 'fallow-report.json')
const coverage = load_coverage_by_src(project_root, args.coverage)

if (!coverage?.size) {
  console.error(`Missing coverage/coverage-final.json under ${project_root}`)
  console.error('Run: npm run test:coverage')
  process.exit(1)
}

/** @type {Record<string, unknown> | null} */
let fallow = null
if (!coverage_only) {
  if (!existsSync(fallow_path)) {
    console.error(`Missing ${fallow_path}`)
    console.error('Run: npx fallow')
    process.exit(1)
  }
  fallow = JSON.parse(readFileSync(fallow_path, 'utf8'))
}

const unused_files = new Set((fallow?.check?.unused_files ?? []).map(f => f.path.replace(/\\/g, '/')))

/** @type {Map<string, object>} */
const file_scores = new Map()
for (const row of fallow?.health?.file_scores ?? []) {
  if (!row.path.startsWith('src/')) continue
  file_scores.set(row.path.replace(/\\/g, '/'), row)
}

/** @type {Map<string, object>} */
const hotspots = new Map()
for (const row of fallow?.health?.hotspots ?? []) {
  hotspots.set(row.path.replace(/\\/g, '/'), row)
}

/** @type {Map<string, object>} */
const targets = new Map()
for (const row of fallow?.health?.targets ?? []) {
  if (!actionable_target(row)) continue
  targets.set(row.path.replace(/\\/g, '/'), row)
}

/** @type {Map<string, { count: number, max_cognitive: number }>} */
const complexity_by_file = new Map()
for (const row of fallow?.health?.findings ?? []) {
  if (!row.path.startsWith('src/')) continue
  const path = row.path.replace(/\\/g, '/')
  const prev = complexity_by_file.get(path) ?? { count: 0, max_cognitive: 0 }
  prev.count++
  prev.max_cognitive = Math.max(prev.max_cognitive, row.cognitive ?? 0)
  complexity_by_file.set(path, prev)
}

const spec_paths = src_path => {
  const stem = src_path
    .replace(/^src\/(?:app\/)?/, '')
    .replace(/\.vue$/, '')
    .replace(/\.js$/, '')
  const folder = src_path.startsWith('src/app/') ? 'app' : src_path.split('/')[1]
  const rest = src_path.startsWith('src/app/') ? stem : stem.split('/').slice(1).join('/')
  return [`specs/${folder}/${rest}.spec.js`]
}

const has_spec = src_path => spec_paths(src_path).some(p => existsSync(join(project_root, p)))

/** @type {Array<object>} */
const ranked = []

for (const [path, cov] of coverage.entries()) {
  const score = risk_score({
    path,
    pct: cov.pct,
    threshold,
    unused: unused_files.has(path),
    has_spec: has_spec(path),
    scores: file_scores.get(path),
    hotspot: hotspots.get(path),
    target: targets.get(path),
    complexity: complexity_by_file.get(path)
  })
  const scores = file_scores.get(path)
  const target = targets.get(path)
  const unused = unused_files.has(path)

  ranked.push({
    path,
    score,
    verdict: unused
      ? 'delete-or-wire'
      : cov.pct < threshold
        ? 'test-first'
        : (scores?.crap_above_threshold ?? 0) > 0
          ? 'refactor-with-tests'
          : 'defer',
    priority: product_priority(path),
    coverage_pct: cov.pct,
    crap_max: scores?.crap_max ?? null,
    crap_untested: scores?.crap_above_threshold ?? 0,
    fan_in: scores?.fan_in ?? null,
    hotspot: hotspots.get(path)?.score ?? null,
    has_spec: has_spec(path),
    fallow_target: target?.category ?? null,
    fallow_note: target?.recommendation ?? null
  })
}

const test_first = ranked
  .filter(r => r.verdict === 'test-first' || r.verdict === 'refactor-with-tests')
  .filter(r => r.score >= 0)
  .sort((a, b) => b.score - a.score)

const delete_or_wire = ranked.filter(r => r.verdict === 'delete-or-wire').sort((a, b) => a.path.localeCompare(b.path))

const istanbul = fallow?.health?.summary
const fmt_row = r => {
  const crap =
    r.crap_max != null ? `${r.crap_max.toFixed(0)}${r.crap_untested ? ` (${r.crap_untested} untested)` : ''}` : '-'
  const spec = r.has_spec ? 'yes' : 'no'
  const note = r.fallow_note ? r.fallow_note.slice(0, 60) : '-'
  return `| ${r.path} | ${r.priority} | ${r.coverage_pct.toFixed(0)} | ${r.score.toFixed(0)} | ${crap} | ${r.fan_in ?? '-'} | ${r.hotspot?.toFixed(1) ?? '-'} | ${spec} | ${r.verdict} | ${note} |`
}

console.log('# Refactor risk (coverage + fallow)')
console.log('')
console.log(`- Project: ${project_root}`)
console.log(`- Coverage gate: ${threshold}%`)
if (fallow) {
  console.log(`- Fallow CRAP match: ${istanbul?.istanbul_matched ?? '?'}/${istanbul?.istanbul_total ?? '?'} functions`)
  if ((istanbul?.istanbul_matched ?? 0) < 100)
    console.log('- Tip: re-run `npm run test:coverage` then `npx fallow` if CRAP match is low')
}
console.log('')

if (delete_or_wire.length) {
  console.log('## Delete or wire (fallow unused-files — do not add tests)')
  console.log('')
  for (const r of delete_or_wire.slice(0, top_n)) console.log(`- \`${r.path}\``)
  if (delete_or_wire.length > top_n) console.log(`\n… and ${delete_or_wire.length - top_n} more.`)
  console.log('')
}

console.log('## Test before refactor (highest risk)')
console.log('')
console.log('| file | pri | cov% | risk | CRAP | fan-in | hotspot | spec | verdict | fallow |')
console.log('| --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- |')

for (const r of test_first.slice(0, top_n)) console.log(fmt_row(r))

if (test_first.length > top_n) console.log(`\n… and ${test_first.length - top_n} more.`)

console.log('')
console.log('## Workflow')
console.log('')
console.log('1. `npm run test:risk` — coverage + fallow + this report')
console.log('2. Pick a **test-first** row; extend or add the `specs/**` mirror spec')
console.log('3. Re-run until cov% and CRAP improve, then refactor')
console.log('4. Tune `.fallowrc.json` per `skills/test-coverage/references/fallow-integration.md`')
