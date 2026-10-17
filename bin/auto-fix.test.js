import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fixer_for, run } from './auto-fix.js'

const scratch = () => {
  const root = resolve(import.meta.dirname, '../artifacts/auto-fix-test')
  mkdir_sync(root, { recursive: true })
  return mkdtemp_sync(join(root, 'case-'))
}

test('a project with vp and a Vite config uses vp from its own root', t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  mkdir_sync(join(dir, 'node_modules/.bin'), { recursive: true })
  mkdir_sync(join(dir, 'src'))
  write_file_sync(join(dir, 'node_modules/.bin/vp'), '')
  write_file_sync(join(dir, 'vite.config.js'), '')
  write_file_sync(join(dir, '.git'), '')
  const fixer = fixer_for(join(dir, 'src/a.js'))
  assert.equal(fixer?.tool, 'vp')
  assert.equal(fixer?.cwd, dir)
})

test('installed ESLint without a config is skipped, never run', t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  mkdir_sync(join(dir, 'node_modules/.bin'), { recursive: true })
  write_file_sync(join(dir, 'node_modules/.bin/eslint'), '')
  write_file_sync(join(dir, '.git'), '')
  assert.equal(fixer_for(join(dir, 'a.js')), null)
  assert.equal(run([join(dir, 'a.js')]), 0)
})

test('an ESLint config without a local ESLint is skipped instead of downloaded', t => {
  const dir = scratch()
  t.after(() => rm_sync(dir, { recursive: true, force: true }))
  write_file_sync(join(dir, 'eslint.config.js'), '')
  assert.equal(fixer_for(join(dir, 'a.js')), null)
})
