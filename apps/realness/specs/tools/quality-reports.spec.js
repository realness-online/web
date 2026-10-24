import assert from 'node:assert/strict'
import {
  spawnSync as spawn_sync,
  execFileSync as exec_file_sync
} from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  rmSync as rm_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join } from 'node:path'
import { it } from 'node:test'
import { project_root, product_paths } from '#root/src/settings/layout.js'
import { out_path } from '#root/src/settings/output.js'

const guard = join(project_root, 'scripts/check-coverage.js')
const fixture = (context, report) => {
  const folder = out_path(
    'specs',
    `coverage-${process.pid}`,
    context.name.replaceAll(' ', '-')
  )
  mkdir_sync(folder, { recursive: true })
  context.after(() => rm_sync(folder, { recursive: true, force: true }))
  const file = join(folder, 'coverage-final.json')
  write_file_sync(file, JSON.stringify(report))
  return spawn_sync(process.execPath, [guard, file], { encoding: 'utf8' })
}

it('coverage refuses an empty report', context => {
  const result = fixture(context, {})
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Coverage must measure app source files/)
})

it('coverage refuses dependency-only measurements', context => {
  const result = fixture(context, {
    [join(project_root, 'node_modules/example.js')]: { s: { 0: 1 } }
  })
  assert.equal(result.status, 1)
})

it('coverage accepts measured app code in src/app', context => {
  const result = fixture(context, {
    [join(product_paths().app, 'utils/itemid.js')]: { s: { 0: 1 } }
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Coverage measured 1 app source files/)
})

it('Fallow loads the product config containing the app source', () => {
  const fallow = join(project_root, 'node_modules/.bin/fallow')
  const configured = JSON.parse(
    exec_file_sync(
      fallow,
      ['config', '--root', project_root, '--format', 'json'],
      { encoding: 'utf8' }
    )
  )
  assert.ok(configured.entry.includes('index.html'))
  assert.ok(configured.entry.includes('src/app/workers/*.js'))
})
