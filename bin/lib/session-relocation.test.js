import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync as mkdir_sync, mkdtempSync as mkdtemp_sync, writeFileSync as write_file_sync, readFileSync as read_file_sync, existsSync as exists_sync, rmSync as rm_sync } from 'node:fs'
import { join, resolve } from 'node:path'
import { hostname } from 'node:os'
import { spawnSync as spawn_sync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { compress_session_chunk, read_session_gzip } from '../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-gzip.js'
import { entryToHtmlLine as entry_to_html_line, sessionHtmlToEntries as session_html_to_entries } from '../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-html.js'
import { relocate_history, restore_history } from './session-relocation.js'

const fixture = t => {
  const scratch = resolve(import.meta.dirname, '../../artifacts/realness/s2c')
  mkdir_sync(scratch, { recursive: true })
  const harness = mkdtemp_sync(join(scratch, 'trial-'))
  t.after(() => rm_sync(harness, { recursive: true, force: true }))
  const source = join(harness, '.pi/agent/sessions')
  const target = join(harness, 'vault/Sessions')
  mkdir_sync(source, { recursive: true })
  const bytes = JSON.stringify({ type: 'session', id: 'original', version: 3, cwd: '/original/project', timestamp: '2026-10-01T00:00:00Z' }) + '\n'
  write_file_sync(join(source, 'original.jsonl'), bytes)
  return { harness, source, target, bytes }
}

test('location trial retains originals and rollback preserves later writes and sessions', t => {
  const f = fixture(t)
  const result = relocate_history(f)
  assert.equal(result.files, 1)
  assert.equal(read_file_sync(join(f.target, 'original.jsonl'), 'utf8'), f.bytes)
  assert.equal(read_file_sync(join(f.source, 'original.jsonl'), 'utf8'), f.bytes)
  const later = JSON.stringify({ type: 'custom', id: 'later', parentId: null, data: 'later entry' }) + '\n'
  write_file_sync(join(f.target, 'original.jsonl'), f.bytes + later)
  write_file_sync(join(f.target, 'new.jsonl'), f.bytes.replace('original', 'new'))
  restore_history(result.manifest)
  assert.equal(read_file_sync(join(f.source, 'original.jsonl'), 'utf8'), f.bytes + later)
  assert.ok(exists_sync(join(f.source, '--original-project--/new.jsonl')))
  assert.equal(read_file_sync(join(f.target, 'original.jsonl'), 'utf8'), f.bytes + later)
})

test('location trial flattens discovery, rewrites parent and state paths, then restores originals', t => {
  const f = fixture(t)
  const project = join(f.source, '--old-project--')
  mkdir_sync(project)
  const child = join(project, 'child.html.gz')
  const header = { type: 'session', id: 'child', version: 3, cwd: '/other/project', timestamp: '2026-10-01T00:00:00Z', parentSession: join(f.source, 'original.jsonl') }
  const packed = compress_session_chunk(entry_to_html_line(header, 'child') + '\n')
  write_file_sync(child, packed)
  const state = join(f.harness, '.pi/agent/state')
  mkdir_sync(state)
  const db = new DatabaseSync(join(state, 'edits.db'))
  t.after(() => db.close())
  db.exec('CREATE TABLE edit (id INTEGER PRIMARY KEY, session TEXT)')
  db.prepare('INSERT INTO edit (session) VALUES (?)').run(child)
  const light = JSON.stringify({ skipped: ['.pi/agent/sessions/--old-project--/child.html.gz'] })
  write_file_sync(join(state, 'light.json'), light)
  const result = relocate_history({ ...f, state })
  const migrated = join(f.target, 'child.html.gz')
  assert.ok(exists_sync(migrated))
  assert.equal(session_html_to_entries(read_session_gzip(read_file_sync(migrated)).text)[0].parentSession, join(f.target, 'original.jsonl'))
  assert.equal(db.prepare('SELECT session FROM edit').get().session, migrated)
  assert.deepEqual(JSON.parse(read_file_sync(join(state, 'light.json'), 'utf8')).skipped, ['vault/Sessions/child.html.gz'])
  restore_history(result.manifest)
  assert.deepEqual(read_file_sync(child), packed)
  assert.equal(db.prepare('SELECT session FROM edit').get().session, child)
  assert.equal(read_file_sync(join(state, 'light.json'), 'utf8'), light)
})

test('rollback restores parent paths when a copied parent is missing', t => {
  const f = fixture(t)
  const child = JSON.parse(f.bytes)
  child.id = 'child'
  child.parentSession = join(f.source, 'original.jsonl')
  const child_bytes = JSON.stringify(child) + '\n'
  write_file_sync(join(f.source, 'child.jsonl'), child_bytes)
  const result = relocate_history(f)
  rm_sync(join(f.target, 'original.jsonl'))
  restore_history(result.manifest)
  assert.equal(read_file_sync(join(f.source, 'child.jsonl'), 'utf8'), child_bytes)
})

test('location trial refuses live writers without creating a destination', t => {
  const f = fixture(t)
  write_file_sync(join(f.source, `original.jsonl.writer-${process.pid}`), JSON.stringify({ pid: process.pid, host: hostname() }))
  assert.throws(() => relocate_history(f), /live writer/)
  assert.ok(!exists_sync(f.target))
})

test('location trial renames duplicate basenames and restores both original paths', t => {
  const f = fixture(t)
  mkdir_sync(join(f.source, 'project'))
  const other = f.bytes.replace('"id":"original"', '"id":"other"')
  write_file_sync(join(f.source, 'project/original.jsonl'), other)
  const result = relocate_history(f)
  const manifest = JSON.parse(read_file_sync(result.manifest, 'utf8'))
  assert.equal(result.files, 2)
  assert.equal(new Set(manifest.files.map(file => file.target_name)).size, 2)
  for (const file of manifest.files) {
    assert.ok(file.target_name.endsWith('.jsonl'))
    assert.equal(read_file_sync(join(f.target, file.target_name), 'utf8'), file.name.startsWith('project/') ? other : f.bytes)
  }
  restore_history(result.manifest)
  assert.equal(read_file_sync(join(f.source, 'original.jsonl'), 'utf8'), f.bytes)
  assert.equal(read_file_sync(join(f.source, 'project/original.jsonl'), 'utf8'), other)
})

test('location trial refuses incomplete tails and changed originals', t => {
  const f = fixture(t)
  const packed = compress_session_chunk(entry_to_html_line(JSON.parse(f.bytes), 'original') + '\n')
  write_file_sync(join(f.source, 'partial.html.gz'), packed.subarray(0, packed.length - 4))
  assert.throws(() => relocate_history(f), /incomplete tail/)
  assert.ok(!exists_sync(f.target))
  rm_sync(join(f.source, 'partial.html.gz'))
  const result = relocate_history(f)
  write_file_sync(join(f.source, 'original.jsonl'), f.bytes + '{"type":"custom","data":"source changed"}\n')
  write_file_sync(join(f.target, 'original.jsonl'), f.bytes + '{"type":"custom","data":"target changed"}\n')
  assert.throws(() => restore_history(result.manifest), /Original changed/)
})

test('public location trial copies and restores; live paths are refused', t => {
  const f = fixture(t)
  const command = resolve(import.meta.dirname, '../session-relocate.js')
  const run = (...args) => spawn_sync(process.execPath, [command, ...args], { encoding: 'utf8', timeout: 20000 })
  const copied = run('trial-copy', f.harness, f.source, f.target)
  assert.equal(copied.status, 0, copied.stderr)
  const restored = run('trial-restore', JSON.parse(copied.stdout).manifest)
  assert.equal(restored.status, 0, restored.stderr)
  assert.equal(read_file_sync(join(f.source, 'original.jsonl'), 'utf8'), f.bytes)
  const refused = run('trial-copy', resolve(import.meta.dirname, '../..'), f.source, f.target)
  assert.notEqual(refused.status, 0)
  assert.match(refused.stderr, /must stay inside artifacts/)
})

test('location trial refuses collisions before copying history', t => {
  const f = fixture(t)
  mkdir_sync(f.target, { recursive: true })
  write_file_sync(join(f.target, 'original.jsonl'), 'different history')
  assert.throws(() => relocate_history(f), /destination already exists/)
  assert.equal(read_file_sync(join(f.source, 'original.jsonl'), 'utf8'), f.bytes)
})
