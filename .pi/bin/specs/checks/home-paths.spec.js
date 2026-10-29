import assert from 'node:assert/strict'
import { it } from 'node:test'
import { execFileSync as exec_file_sync } from 'node:child_process'
import {
  existsSync as exists_sync,
  readdirSync as readdir_sync,
  readFileSync as read_file_sync,
  statSync as stat_sync
} from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { has_repo, repo_args } from '../../lib/repo-git.js'

const root = resolve(import.meta.dirname, '../../../..')

const skipped = new Set(['node_modules', '.git', 'dist', 'coverage', 'artifacts', 'work', 'vault', '.npm', '.auto'])
const skipped_files = new Set(['person.local.html', 'AGENTS.md', 'package-lock.json'])

const allowed = new Map([
  ['apps/realness/specs/app/terminal/capture/pi.tui', 'terminal recording; bytes are the fixture'],
  [
    '.pi/skills/zoom-to-ableton/references/scott-2024-effect-rack-devices.xml',
    'exported Ableton rack; device paths are recorded data'
  ],
  ['apps/realness/public/brands/inkscape.svg', 'third-party logo; its authoring metadata names its designer']
])

const HOME = /(?:\/Users|\/home)\/(?!person\b|runner\b|<)[a-z][a-z0-9._-]*/i

const shipped_by_git = directory =>
  exec_file_sync('git', [...repo_args(directory), 'ls-files', '-co', '--exclude-standard', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
    .split('\0')
    .filter(Boolean)
    .map(name => join(directory, name))
    .filter(path => {
      try {
        return stat_sync(path).isFile()
      } catch {
        return false
      }
    })

const walk = (directory, found = []) => {
  if (directory !== root && exists_sync(join(directory, '.git'))) {
    found.push(...shipped_by_git(directory))
    return found
  }
  for (const entry of readdir_sync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (
        !skipped.has(entry.name) &&
        !entry.name.endsWith('_cache') &&
        !(entry.name === 'agent' && directory === join(root, '.pi'))
      )
        walk(path, found)
    } else if (entry.isFile()) found.push(path)
  }
  return found
}

const scanned = () =>
  (has_repo(root) ? shipped_by_git(root) : walk(root)).filter(
    path => !skipped_files.has(basename(path)) && !path.endsWith('.log') && stat_sync(path).size < 2_000_000
  )

it("shared files name no one's home folder", () => {
  const offenders = []
  for (const path of scanned()) {
    const name = relative(root, path)
    if (allowed.has(name)) continue
    const text = read_file_sync(path, 'latin1')
    const match = text.match(HOME)
    if (match) offenders.push(`${name}: ${match[0]}`)
  }
  assert.deepEqual(offenders, [], 'Use a path relative to the checkout, a {{placeholder}}, or /home/person in fixtures')
})

it('allowed recordings still exist, so the list cannot rot', () => {
  for (const name of allowed.keys()) assert.ok(stat_sync(join(root, name)).isFile(), name)
})
