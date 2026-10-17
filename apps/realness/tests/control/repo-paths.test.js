import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync as exists_sync,
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  statSync as stat_sync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath as file_url_to_path } from 'node:url'
import { ROOT } from '../../src/control/paths.js'
import { source_folders } from '#root/src/settings/layout.js'

const SELF = file_url_to_path(import.meta.url)
const HARNESS = join(ROOT, '../..')
const SCANNED = [
  'server',
  'tools',
  'lib',
  'src',
  'src/app',
  'tests',
  'frontend/scripts',
  'package.json'
]
const SKIP = new Set(['node_modules', 'dist', '.vite', 'coverage', 'fixtures'])
const NOT_REPO = new Set(['tests/halo/infer.test.js: lib/page.js'])
const SOURCE = /\.(sh|js|ts|json|vue)$/
const TOP = `(?:server|tools|lib|frontend|src/settings|${Object.values(source_folders).join('|')})`
const FILE = '[\\w./-]+?\\.(?:sh|js|ts|json|vue)(?![\\w.])'

const LEADS = [
  [
    new RegExp(
      `(?:\\$\\{?(?:REPO|DIR|repo|root_dir)\\}?|\\$\\{config\\.workdir\\}|\\$HOME/realness|~/realness|/mnt/fc)/(${FILE})`,
      'g'
    ),
    ROOT
  ],
  [new RegExp(`(?<![\\w/.$}-])(${TOP}/${FILE})`, 'g'), ROOT],
  [new RegExp(`(?:\\$root/|(?<![\\w/]))(apps/realness/${FILE})`, 'g'), HARNESS],
  [
    new RegExp(
      `new URL\\(["'\`]((?:\\.\\./)+${FILE})["'\`], import\\.meta\\.url\\)`,
      'g'
    ),
    null
  ]
]

const walk = path => {
  if (stat_sync(path).isFile()) return SOURCE.test(path) ? [path] : []
  return readdir_sync(path)
    .filter(name => !SKIP.has(name))
    .flatMap(name => walk(join(path, name)))
}

const AT_LEAST = 100

/** Each [file, path, root] a scanned file names. */
const named_paths = () =>
  SCANNED.flatMap(entry => walk(join(ROOT, entry)))
    .filter(file => file !== SELF)
    .flatMap(file => {
      const text = read_file_sync(file, 'utf8')
      return LEADS.flatMap(([pattern, base]) =>
        [...text.matchAll(pattern)].map(([, path]) => [
          file,
          path,
          base ?? dirname(file)
        ])
      )
    })

test('every repo path named in scripts and sources exists', () => {
  const missing = []
  const checked = new Set()
  for (const [file, path, base] of named_paths()) {
    if (path.includes('*') || path.includes('$')) continue
    const named = `${file.slice(ROOT.length + 1)}: ${path}`
    checked.add(named)
    if (!NOT_REPO.has(named) && !exists_sync(join(base, path)))
      missing.push(named)
  }
  assert.ok(
    checked.size > AT_LEAST,
    `only ${checked.size} paths found; the patterns stopped matching`
  )
  assert.deepEqual([...new Set(missing)], [])
})
