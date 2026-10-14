#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { existsSync as exists_sync, mkdirSync as mkdir_sync, readFileSync as read_file_sync, rmSync as rm_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const root = resolve(file_url_to_path(new URL('..', import.meta.url)))
const product = join(root, 'apps/realness')
const out = join(root, 'artifacts/coverage')

/** The test files `npm run test:harness` runs, read from its script so the two never drift. */
const harness_files = () => {
  const script = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8')).scripts['test:harness']
  return script.split(/\s+/).filter(word => word.endsWith('.test.js'))
}

/** Node's built-in coverage over `include`, writing lcov to `name.lcov`. */
const node_part = (name, cwd, include, exclude, files) => ({
  name,
  lcov: join(out, `${name}.lcov`),
  run: () =>
    spawn_sync(
      process.execPath,
      [
        '--test',
        '--experimental-test-coverage',
        ...include.map(glob => `--test-coverage-include=${glob}`),
        ...exclude.map(glob => `--test-coverage-exclude=${glob}`),
        '--test-reporter=spec',
        '--test-reporter-destination=stdout',
        '--test-reporter=lcov',
        `--test-reporter-destination=${join(out, `${name}.lcov`)}`,
        ...files
      ],
      { cwd, stdio: 'inherit' }
    )
})

/** A product npm script that writes lcov where its config says. */
const npm_part = (name, script, lcov) => ({
  name,
  lcov,
  run: () => spawn_sync('npm', ['--prefix', product, 'run', script], { stdio: 'inherit' })
})

const parts = () => [
  node_part(
    'harness',
    root,
    ['bin/**/*.js', '.pi/extensions/**/*.js', '.pi/skills/**/*.js'],
    ['**/*.test.js', '**/node_modules/**'],
    harness_files()
  ),
  node_part(
    'backend',
    product,
    ['src/**/*.js', 'lib/**/*.js', 'tools/**/*.js', 'server/**/*.js', 'themes/**/*.js'],
    ['src/app/**', 'src/sign-on/browser/**', '**/node_modules/**', '**/dist/**'],
    ['tests/**/*.test.js']
  ),
  npm_part('functions', 'test:functions:coverage', join(product, 'functions/coverage/lcov.info')),
  npm_part('frontend', 'test:coverage', join(root, 'artifacts/brayness/frontend/coverage/lcov.info'))
]

/** Found and hit counts for lines, branches, and functions in one lcov file. */
export const lcov_totals = text => {
  const totals = { lines: [0, 0], branches: [0, 0], functions: [0, 0] }
  const keys = { LF: ['lines', 0], LH: ['lines', 1], BRF: ['branches', 0], BRH: ['branches', 1], FNF: ['functions', 0], FNH: ['functions', 1] }
  for (const line of text.split('\n')) {
    const [key, value] = line.split(':')
    if (keys[key]) totals[keys[key][0]][keys[key][1]] += Number(value)
  }
  return totals
}

const percent = ([found, hit]) => (found ? `${((hit / found) * 100).toFixed(2)}%` : '-').padStart(8)

export const summary = rows => {
  const total = { lines: [0, 0], branches: [0, 0], functions: [0, 0] }
  const lines = [`${'part'.padEnd(10)}${'lines'.padStart(8)}${'branches'.padStart(10)}${'functions'.padStart(11)}  result`]
  for (const { name, totals, ok } of rows) {
    for (const kind of Object.keys(total)) {
      total[kind][0] += totals?.[kind][0] ?? 0
      total[kind][1] += totals?.[kind][1] ?? 0
    }
    lines.push(`${name.padEnd(10)}${totals ? `${percent(totals.lines)}${percent(totals.branches).padStart(10)}${percent(totals.functions).padStart(11)}` : '  no report'.padEnd(29)}  ${ok ? 'ok' : 'FAILED'}`)
  }
  lines.push(`${'all'.padEnd(10)}${percent(total.lines)}${percent(total.branches).padStart(10)}${percent(total.functions).padStart(11)}`)
  return lines.join('\n')
}

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  mkdir_sync(out, { recursive: true })
  const rows = parts().map(part => {
    process.stdout.write(`\n== ${part.name} coverage\n`)
    rm_sync(part.lcov, { force: true })
    const { status } = part.run()
    const totals = exists_sync(part.lcov) ? lcov_totals(read_file_sync(part.lcov, 'utf8')) : null
    return { name: part.name, totals, ok: status === 0 }
  })
  process.stdout.write(`\n${summary(rows)}\n\nreports: ${out}, product functions/coverage, artifacts/brayness/frontend/coverage\n`)
  process.exitCode = rows.every(row => row.ok) ? 0 : 1
}
