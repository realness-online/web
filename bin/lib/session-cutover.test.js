import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, readFileSync as read_file_sync, writeFileSync as write_file_sync, rmSync as rm_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync as spawn_sync } from 'node:child_process'
import { migrate_sessions, rollback_sessions } from './session-cutover.js'

const fixture = t => {
  const scratch = resolve(import.meta.dirname, '../../artifacts/realness/cutover-tests')
  mkdir_sync(scratch, { recursive: true })
  const root = mkdtemp_sync(join(scratch, 'trial-'))
  t.after(() => rm_sync(root, { recursive: true, force: true }))
  mkdir_sync(join(root, '.pi/agent/sessions/project'), { recursive: true })
  const bytes = JSON.stringify({ type: 'session', id: 'one', version: 3, cwd: '/original/project', timestamp: '2026-10-01T00:00:00Z' }) + '\n'
  write_file_sync(join(root, '.pi/agent/sessions/project/one.jsonl'), bytes)
  write_file_sync(join(root, 'package.json'), JSON.stringify({ type: 'module', realness: { person: '+15555550100' } }))
  return { root, bytes }
}

test('cutover activates verified copies and rollback preserves later entries and unrelated settings', t => {
  const { root, bytes } = fixture(t)
  const migrated = migrate_sessions(root, { trial: true })
  assert.equal(migrated.files, 1)
  const config = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  assert.equal(config.realness.sessions, 'vault/Sessions')
  config.realness.plans = 'vault/Projects'
  write_file_sync(join(root, 'package.json'), JSON.stringify(config))
  const later = '{"type":"custom","data":"written after cutover"}\n'
  write_file_sync(join(root, 'vault/Sessions/one.jsonl'), bytes + later)
  rollback_sessions(root, { trial: true })
  const restored = JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8'))
  assert.equal(restored.realness.sessions, undefined)
  assert.equal(restored.realness.plans, 'vault/Projects')
  assert.equal(read_file_sync(join(root, '.pi/agent/sessions/project/one.jsonl'), 'utf8'), bytes + later)
})

test('cutover refuses changed session settings and does not overwrite them', t => {
  const { root } = fixture(t)
  migrate_sessions(root, { trial: true })
  const config = { realness: { sessions: 'vault/Other' } }
  write_file_sync(join(root, 'package.json'), JSON.stringify(config))
  assert.throws(() => rollback_sessions(root, { trial: true }), /settings changed/)
  assert.deepEqual(JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8')), config)
})

test('public trial command activates and rolls back the copied harness', t => {
  const { root } = fixture(t)
  const command = resolve(import.meta.dirname, '../session-relocate.js')
  const run = action => spawn_sync(process.execPath, [command, action, root], { encoding: 'utf8', timeout: 20000 })
  const migrated = run('trial-migrate')
  assert.equal(migrated.status, 0, migrated.stderr)
  assert.equal(JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8')).realness.sessions, 'vault/Sessions')
  const restored = run('trial-rollback')
  assert.equal(restored.status, 0, restored.stderr)
  assert.equal(JSON.parse(read_file_sync(join(root, 'package.json'), 'utf8')).realness.sessions, undefined)
})

test('live command refuses a detected Pi process even without agent environment', t => {
  const { root: fixture_root } = fixture(t)
  const root = resolve(import.meta.dirname, '../..')
  const tools = join(fixture_root, 'tools')
  mkdir_sync(tools)
  write_file_sync(join(tools, 'ps'), '#!/bin/sh\nprintf "12345 /installed/pi\\n"\n', { mode: 0o755 })
  const env = { ...process.env, PATH: `${tools}:${process.env.PATH}` }
  delete env.PI_SESSION_FILE
  const before = read_file_sync(join(root, 'package.json'))
  const result = spawn_sync(process.execPath, [join(root, 'bin/session-relocate.js'), 'migrate'], { env, encoding: 'utf8', timeout: 20000 })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Close all Pi processes first/)
  assert.deepEqual(read_file_sync(join(root, 'package.json')), before)
})

test('live command refuses an agent session before changing settings', () => {
  const root = resolve(import.meta.dirname, '../..')
  const before = read_file_sync(join(root, 'package.json'))
  const result = spawn_sync(process.execPath, [join(root, 'bin/session-relocate.js'), 'migrate'], { env: { ...process.env, PI_SESSION_FILE: join(root, 'current.html.gz') }, encoding: 'utf8', timeout: 20000 })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Close Pi/)
  assert.deepEqual(read_file_sync(join(root, 'package.json')), before)
})
