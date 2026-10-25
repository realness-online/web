import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { it } from 'node:test'

const root = resolve(import.meta.dirname, '../../../..')
const check = (context, files, args = []) => {
  const parent = join(root, 'artifacts/realness/extension-check')
  mkdir_sync(parent, { recursive: true })
  const fixture = mkdtemp_sync(join(parent, 'fixture-'))
  context.after(() => rm_sync(fixture, { recursive: true, force: true }))
  for (const file of files) {
    mkdir_sync(join(fixture, file, '..'), { recursive: true })
    write_file_sync(join(fixture, file), '')
  }
  return spawn_sync(process.execPath, [join(root, '.pi/bin/checks/no-mjs.js'), ...args], {
    cwd: fixture,
    encoding: 'utf8'
  })
}

it('rejects .mjs in owned source', context => {
  const result = check(context, ['bin/tool.mjs'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /bin\/tool\.mjs/)
})

it('rejects all TypeScript extensions under .pi', context => {
  for (const extension of ['ts', 'tsx', 'mts', 'cts']) {
    const result = check(context, [`.pi/extensions/example/index.${extension}`])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Use .js with JSDoc/)
  }
})

it('accepts JavaScript and leaves app TypeScript outside this migration', context => {
  const result = check(context, ['.pi/extensions/example/index.js', 'apps/realness/tools/desktop/entry.ts'])
  assert.equal(result.status, 0, result.stderr)
})

it('does not inspect installed packages, fork state, external projects or build output', context => {
  const result = check(context, [
    '.pi/node_modules/library/index.ts',
    '.pi/runtime/node_modules/library/index.mjs',
    '.pi/agent/state/pi-forks/source/index.ts',
    'work/pi/source/index.mjs',
    'artifacts/trial/index.mjs',
    'apps/realness/dist/index.mjs'
  ])
  assert.equal(result.status, 0, result.stderr)
})

it('--all includes artifacts but still skips installed packages', context => {
  const result = check(
    context,
    ['artifacts/trial/index.mjs', 'artifacts/trial/node_modules/library/index.mjs'],
    ['--all']
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /artifacts\/trial\/index\.mjs/)
  assert.doesNotMatch(result.stderr, /library/)
})
