#!/usr/bin/env node
import { spawnSync as spawn_sync } from 'node:child_process'
import { existsSync as exists_sync, mkdirSync as mkdir_sync, readFileSync as read_file_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'

const root = resolve(file_url_to_path(new URL('../..', import.meta.url)))
const product = join(root, 'apps/realness')
const out = join(root, 'artifacts/coverage')

/**
 * What Node coverage counts, from the harness root. Both Node parts count all
 * of it: harness tests reach product code and product tests reach `bin/`.
 */
const NODE_INCLUDE = [
  'bin/**/*.js',
  '.pi/extensions/**/*.js',
  '.pi/skills/**/*.js',
  'apps/realness/src/**/*.js',
  'apps/realness/lib/**/*.js',
  'apps/realness/tools/**/*.js',
  'apps/realness/server/**/*.js',
  'apps/realness/themes/**/*.js',
  'apps/realness/scripts/**/*.js'
]
const NODE_EXCLUDE = [
  '**/*.test.js',
  '**/*.spec.js',
  '**/node_modules/**',
  '**/dist/**',
  'apps/realness/src/app/**'
]

/** The test globs `npm run test:harness` runs, read from its script so the two never drift. */
export const harness_files = (script = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8')).scripts['test:harness']) =>
  script
    .split(/\s+/)
    .map(word => word.replace(/^'|'$/g, ''))
    .filter(word => word.endsWith('.test.js'))

/** Node's built-in coverage, run from the harness root, writing lcov to `name.lcov`. */
const node_part = (name, files) => ({
  name,
  lcov: join(out, `${name}.lcov`),
  base: root,
  run: () =>
    spawn_sync(
      process.execPath,
      [
        '--test',
        '--experimental-test-coverage',
        ...NODE_INCLUDE.map(glob => `--test-coverage-include=${glob}`),
        ...NODE_EXCLUDE.map(glob => `--test-coverage-exclude=${glob}`),
        '--test-reporter=spec',
        '--test-reporter-destination=stdout',
        '--test-reporter=lcov',
        `--test-reporter-destination=${join(out, `${name}.lcov`)}`,
        ...files
      ],
      { cwd: root, stdio: 'inherit' }
    )
})

/** A product npm script; `base` is the folder its lcov paths are relative to. */
const npm_part = (name, script, lcov, base) => ({
  name,
  lcov,
  base,
  run: () => spawn_sync('npm', ['--prefix', product, 'run', script], { stdio: 'inherit' })
})

const parts = () => [
  node_part('harness', harness_files()),
  node_part('backend', ['apps/realness/specs/!(app)/**/*.spec.js']),
  npm_part('functions', 'test:functions:coverage', join(product, 'functions/coverage/lcov.info'), join(product, 'functions')),
  npm_part('frontend', 'test:coverage', join(root, 'artifacts/realness/frontend/coverage/lcov.info'), product)
]

/**
 * Per-file hits from one lcov report, keyed by absolute path. Each line,
 * branch, and function maps to whether it ran at least once.
 */
export const parse_lcov = (text, base) => {
  const files = new Map()
  let file
  const mark = (kind, key, hit) => file[kind].set(key, file[kind].get(key) || hit)
  for (const line of text.split('\n')) {
    const at = line.indexOf(':')
    const tag = line.slice(0, at)
    const value = line.slice(at + 1)
    if (tag === 'SF') {
      const path = resolve(base, value)
      file = files.get(path) ?? { lines: new Map(), branches: new Map(), functions: new Map() }
      files.set(path, file)
    } else if (tag === 'DA') {
      const [number, count] = value.split(',')
      mark('lines', number, Number(count) > 0)
    } else if (tag === 'BRDA') {
      const [number, block, branch, taken] = value.split(',')
      mark('branches', `${number},${block},${branch}`, taken !== '-' && Number(taken) > 0)
    } else if (tag === 'FN') mark('functions', value.slice(value.indexOf(',') + 1), false)
    else if (tag === 'FNDA') {
      const [count, ...name] = value.split(',')
      mark('functions', name.join(','), Number(count) > 0)
    }
  }
  return files
}

/** Union of reports: a line, branch, or function counts once, hit if any report ran it. */
export const merge = reports => {
  const all = new Map()
  for (const files of reports)
    for (const [path, file] of files) {
      const into = all.get(path) ?? { lines: new Map(), branches: new Map(), functions: new Map() }
      for (const kind of ['lines', 'branches', 'functions'])
        for (const [key, hit] of file[kind]) into[kind].set(key, into[kind].get(key) || hit)
      all.set(path, into)
    }
  return all
}

/** Found and hit counts for lines, branches, and functions across files. */
export const totals = files => {
  const sum = { files: files.size, lines: [0, 0], branches: [0, 0], functions: [0, 0] }
  for (const file of files.values())
    for (const kind of ['lines', 'branches', 'functions']) {
      sum[kind][0] += file[kind].size
      for (const hit of file[kind].values()) if (hit) sum[kind][1] += 1
    }
  return sum
}

const percent = ([found, hit]) => (found ? `${((hit / found) * 100).toFixed(2)}%` : '-').padStart(8)
const row = (name, sum) =>
  `${name.padEnd(10)}${String(sum.files).padStart(6)}${percent(sum.lines)}${percent(sum.branches).padStart(10)}${percent(sum.functions).padStart(11)}`

const SOURCE_ROOTS = ['bin', '.pi/extensions', '.pi/skills', 'apps/realness']
const NOT_SOURCE = /(^|\/)(tests?|specs|checks|node_modules|dist|coverage|fixtures|mocks)\/|\.(test|spec|check)\.js$|\.d\.ts$|(^|\/)[\w.-]*config(\.[\w-]+)*\.js$/

/** Tracked and new source files under the measured roots, relative to the harness root. */
export const source_files = (list = () =>
  spawn_sync('git', ['ls-files', '-co', '--exclude-standard', '--', ...SOURCE_ROOTS], { cwd: root, encoding: 'utf8' }).stdout) =>
  list()
    .split('\n')
    .filter(path => /\.(js|vue|sh|py|rs|ts)$/.test(path) && !NOT_SOURCE.test(path))

/**
 * Source files no report mentions. Node lists only files a test loaded, so
 * these are missing from every percentage rather than counted at zero.
 */
export const untested = (sources, whole) => {
  const seen = new Set([...whole.keys()].map(path => relative(root, path)))
  const missing = sources.filter(path => !seen.has(path))
  return {
    scripts: missing.filter(path => /\.(js|vue)$/.test(path)).sort(),
    other: missing.filter(path => !/\.(js|vue)$/.test(path)).sort()
  }
}

/** One line per part, then the merged whole. */
export const summary = (rows, whole) =>
  [
    `${'part'.padEnd(10)}${'files'.padStart(6)}${'lines'.padStart(8)}${'branches'.padStart(10)}${'functions'.padStart(11)}  result`,
    ...rows.map(({ name, files, ok }) => `${files ? row(name, totals(files)) : `${name.padEnd(10)}${'no report'.padStart(14)}`.padEnd(45)}  ${ok ? 'ok' : 'FAILED'}`),
    row('all', totals(whole))
  ].join('\n')

if (process.argv[1] === file_url_to_path(import.meta.url)) {
  mkdir_sync(out, { recursive: true })
  const rows = parts().map(part => {
    process.stdout.write(`\n== ${part.name} coverage\n`)
    rm_sync(part.lcov, { force: true })
    const { status } = part.run()
    const files = exists_sync(part.lcov) ? parse_lcov(read_file_sync(part.lcov, 'utf8'), part.base) : null
    return { name: part.name, files, ok: status === 0 }
  })
  const whole = merge(rows.map(({ files }) => files).filter(Boolean))
  const { scripts, other } = untested(source_files(), whole)
  write_file_sync(join(out, 'untested.txt'), `${[...scripts, ...other].join('\n')}\n`)
  process.stdout.write(
    `\n${summary(rows, whole)}\n\n"all" counts each file once, hit if any part ran it.\n` +
      `untested: ${scripts.length} JavaScript and Vue files no test loads, left out of every percentage\n` +
      `not measured: ${other.length} shell, Python, Rust, and TypeScript files\n` +
      `lists: ${join(out, 'untested.txt')}\nreports: ${out}, product functions/coverage, artifacts/realness/frontend/coverage\n`
  )
  process.exitCode = rows.every(({ ok }) => ok) ? 0 : 1
}
