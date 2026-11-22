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
const app_package = JSON.stringify({ imports: { '#root/*': './*' } })
const check = (context, files) => {
  const parent = join(root, 'artifacts/realness/deep-imports-check')
  mkdir_sync(parent, { recursive: true })
  const fixture = mkdtemp_sync(join(parent, 'fixture-'))
  context.after(() => rm_sync(fixture, { recursive: true, force: true }))
  for (const [file, text] of Object.entries({
    'apps/realness/package.json': app_package,
    '.pi/package.json': '{}',
    ...files
  })) {
    mkdir_sync(join(fixture, file, '..'), { recursive: true })
    write_file_sync(join(fixture, file), text)
  }
  return spawn_sync(process.execPath, [join(root, '.pi/bin/checks/deep-imports.js')], {
    cwd: fixture,
    encoding: 'utf8'
  })
}

it('rejects a deep import inside the app', context => {
  const result = check(context, { 'apps/realness/specs/a/b/c.spec.js': "import x from '../../../lib/x.js'\n" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /use #root\//)
})

it('rejects a deep import from the harness into the app', context => {
  const result = check(context, { '.pi/bin/lib/x.js': "import x from '../../../apps/realness/lib/x.js'\n" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /use realness\//)
})

it('allows a deep import that leaves its package', context => {
  const result = check(context, {
    'apps/realness/functions/package.json': '{}',
    'apps/realness/functions/specs/a/x.spec.js': "import x from '../../../tools/x.js'\n",
    'apps/realness/src/app/x.js': "import x from '../../../../.pi/bin/x.js'\n"
  })
  assert.equal(result.status, 0, result.stderr)
})

it('allows short relative imports and #root', context => {
  const result = check(context, {
    'apps/realness/src/a/x.js': "import a from '../../y.js'\nimport b from '#root/lib/x.js'\n"
  })
  assert.equal(result.status, 0, result.stderr)
})
