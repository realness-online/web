import assert from 'node:assert/strict'
import { it } from 'node:test'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fix, fixer_for } from '../../harness/auto-fix.js'

const scratch = () => {
  const root = resolve(import.meta.dirname, '../../../artifacts/auto-fix-test')
  mkdir_sync(root, { recursive: true })
  return mkdtemp_sync(join(root, 'case-'))
}

const vp_project = dir => {
  mkdir_sync(join(dir, 'node_modules/.bin'), { recursive: true })
  mkdir_sync(join(dir, 'src'))
  write_file_sync(join(dir, 'node_modules/.bin/vp'), '')
  write_file_sync(join(dir, 'vite.config.js'), '')
  write_file_sync(join(dir, '.git'), '')
}

it('a project with vp and a Vite config checks code with vp from its own root', t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  vp_project(dir)
  const fixer = fixer_for(join(dir, 'src/a.vue'))
  assert.equal(fixer?.tool, 'vp')
  assert.equal(fixer?.cwd, dir)
  assert.deepEqual(fixer?.steps[0][1], ['check', '--fix'])
})

it('text in a vp project is formatted with vp fmt, never prettier', t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  vp_project(dir)
  const fixer = fixer_for(join(dir, 'src/notes.md'))
  assert.equal(fixer?.tool, 'vp fmt')
  assert.equal(fixer?.steps[0][1][0], 'fmt')
})

it('text outside a vp project is left alone', t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  write_file_sync(join(dir, '.git'), '')
  assert.equal(fixer_for(join(dir, 'notes.md')), null)
})

it('python is fixed and formatted with ruff', () => {
  const fixer = fixer_for('/project/tool.py')
  assert.equal(fixer?.tool, 'ruff')
  assert.equal(fixer?.steps.length, 2)
})

it('installed ESLint without a config is skipped, never run', async t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  mkdir_sync(join(dir, 'node_modules/.bin'), { recursive: true })
  write_file_sync(join(dir, 'node_modules/.bin/eslint'), '')
  write_file_sync(join(dir, '.git'), '')
  write_file_sync(join(dir, 'a.js'), '')
  assert.equal(fixer_for(join(dir, 'a.js')), null)
  assert.deepEqual(await fix([join(dir, 'a.js')]), { total: 0, changed: [], failed: [] })
})

it('an ESLint config without a local ESLint is skipped instead of downloaded', t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  write_file_sync(join(dir, 'eslint.config.js'), '')
  assert.equal(fixer_for(join(dir, 'a.js')), null)
})

it('files under node_modules or missing files are never fixed', async t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  vp_project(dir)
  write_file_sync(join(dir, 'node_modules/x.js'), '')
  assert.deepEqual(await fix([join(dir, 'node_modules/x.js'), join(dir, 'src/gone.js')]), { total: 0, changed: [], failed: [] })
})
