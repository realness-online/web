import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, rmSync as rm_sync, writeFileSync as write_file_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '..')

/** Run a harness command the way a person does, from the harness root. */
const run = (script, args = [], input) =>
  spawn_sync(process.execPath, [join(root, 'bin', script), ...args], { cwd: root, encoding: 'utf8', input })

const scratch = t => {
  mkdir_sync(join(root, 'artifacts/commands-cli'), { recursive: true })
  const path = mkdtemp_sync(join(root, 'artifacts/commands-cli/test-'))
  t.after(() => rm_sync(path, { recursive: true, force: true }))
  return path
}

test('comment-check fails on a plain comment and passes JSDoc and directives', t => {
  const dir = scratch(t)
  write_file_sync(join(dir, 'kept.js'), '/** Why this exists. */\nexport const a = 1\n/* eslint-disable no-console */\n')
  const clean = run('comment-check.js', [dir])
  assert.equal(clean.status, 0, clean.stdout)
  assert.match(clean.stdout, /comments: 0 hit/)

  write_file_sync(join(dir, 'chatty.js'), 'export const b = 2 // explains the obvious\n')
  const dirty = run('comment-check.js', [dir])
  assert.equal(dirty.status, 1)
  assert.match(dirty.stdout, /chatty\.js:1 {2}comment {2}\/\/ explains the obvious/)
  assert.match(dirty.stdout, /comments: 1 hit/)
})

test('plan-shape names each broken rule and counts failed plans', () => {
  const result = run('plan-shape.js', ['--plans', join(root, 'bin/fixtures/plans')])
  assert.equal(result.status, 1)
  assert.match(result.stdout, /FAIL bad\.md/)
  assert.match(result.stdout, /title first/)
  assert.match(result.stdout, /dag present/)
  assert.match(result.stdout, /no other ## headings: line 9: ## Extra/)
  assert.doesNotMatch(result.stdout, /good\.md/)
  assert.match(result.stdout, /2 plans, 1 failed/)
  assert.equal(run('plan-shape.js', ['--plans', join(root, 'bin/fixtures/plans'), '--warn']).status, 0)
})

test('plan-shape has nothing to check without a plans folder', t => {
  const result = run('plan-shape.js', ['--plans', join(scratch(t), 'none')])
  assert.equal(result.status, 0)
  assert.match(result.stdout, /nothing to check/)
})

test('palette-sync and ghostty-theme report the checkout in sync', () => {
  const palette = run('palette-sync.js', ['--check'])
  assert.equal(palette.status, 0, palette.stderr)
  const theme = run('ghostty-theme.js', ['--check'])
  assert.equal(theme.status, 0, theme.stderr)
})

test('mermaid-fit says whether a diagram fits the pane', () => {
  const diagram = '```mermaid\nflowchart LR\n  a --> b\n```\n'
  const wide = run('mermaid-fit.js', ['--max', '200', '-'], diagram)
  assert.equal(wide.status, 0, wide.stderr)
  assert.match(wide.stdout, /-> renders/)
  const narrow = run('mermaid-fit.js', ['--max', '1', '-'], diagram)
  assert.equal(narrow.status, 1)
  assert.match(narrow.stdout, /-> raw fence/)
})
