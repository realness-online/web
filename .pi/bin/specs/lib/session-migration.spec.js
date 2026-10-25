import assert from 'node:assert/strict'
import { it } from 'node:test'
import { spawnSync as spawn_sync } from 'node:child_process'
import {
  mkdirSync as mkdir_sync,
  mkdtempSync as mkdtemp_sync,
  readFileSync as read_file_sync,
  readdirSync as readdir_sync,
  rmSync as rm_sync,
  symlinkSync as symlink_sync,
  writeFileSync as write_file_sync
} from 'node:fs'
import { join, resolve } from 'node:path'
import { hostname } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { convert_history, rollback_history } from '../../lib/session-migration.js'
import { read_session_gzip } from '../../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-gzip.js'
import { sessionHtmlToEntries as session_html_to_entries } from '../../../../.pi/runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-html.js'

const stringify_state = value => JSON.stringify(value, (_, item) => (Object.is(item, -0) ? JSON.rawJSON('-0') : item))

const fixture = () => {
  const scratch = resolve(import.meta.dirname, '../../../../artifacts/session-migration')
  mkdir_sync(scratch, { recursive: true })
  const directory = mkdtemp_sync(join(scratch, 'trial-'))
  const root = join(directory, 'sessions')
  const backup = join(directory, 'backup')
  mkdir_sync(root)
  const first = join(root, 'first.jsonl')
  const second = join(root, 'second.jsonl')
  const original = ` {"cwd":"${root}","id":"first","type":"session","version":3,"timestamp":"2026-10-01T00:00:00Z"} \n{"type":"message","id":"u1","parentId":null,"timestamp":"2026-10-01T00:00:01Z","message":{"role":"user","content":"first","timestamp":1},"negative":-0}\n`
  write_file_sync(first, original)
  write_file_sync(
    second,
    `${JSON.stringify({ type: 'session', id: 'second', version: 3, cwd: root, timestamp: '2026-10-01T00:00:00Z', parentSession: first })}\n`
  )
  return { directory, root, backup, first, second, original }
}
const child_write = (action, path, parent = '') => {
  const result = spawn_sync(
    process.execPath,
    [resolve(import.meta.dirname, '../fixtures/migration-session-writer.js'), action, path, parent],
    { encoding: 'utf8', timeout: 20000 }
  )
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}

it('conversion updates parent paths; unchanged rollback restores byte-exact JSONL', () => {
  const f = fixture()
  try {
    const result = convert_history(f)
    assert.equal(result.files, 2)
    const second = session_html_to_entries(
      read_session_gzip(read_file_sync(f.second.replace('.jsonl', '.html.gz'))).text
    )
    assert.equal(second[0].parentSession, f.first.replace('.jsonl', '.html.gz'))
    assert.ok(!readdir_sync(f.root).some(name => name.endsWith('.jsonl')))
    assert.equal(rollback_history(result.manifest).files, 2)
    assert.equal(read_file_sync(f.first, 'utf8'), f.original)
    assert.equal(JSON.parse(read_file_sync(f.second, 'utf8')).parentSession, f.first)
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('rollback retains later entries, new sessions, parent paths, and negative zero', () => {
  const f = fixture()
  try {
    const { manifest } = convert_history(f)
    const compressed = f.first.replace('.jsonl', '.html.gz')
    child_write('append', compressed)
    const created = child_write('create', f.root, compressed)
    const result = rollback_history(manifest)
    assert.equal(result.files, 3)
    const entries = read_file_sync(f.first, 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(entries.length, 3)
    assert.ok(Object.is(entries[1].negative, -0))
    assert.equal(entries[2].message.content, 'recorded after the format switch')
    const new_entries = read_file_sync(created.replace('.html.gz', '.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    assert.equal(new_entries[0].parentSession, f.first)
    assert.ok(!readdir_sync(f.root).some(name => name.endsWith('.html.gz')))
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('migration refuses the current session before creating backups', () => {
  const f = fixture()
  const previous = process.env.PI_SESSION_FILE
  try {
    process.env.PI_SESSION_FILE = f.first
    assert.throws(() => convert_history(f), /current session/)
    assert.equal(read_file_sync(f.first, 'utf8'), f.original)
    assert.ok(!readdir_sync(f.directory).includes('backup'))
  } finally {
    if (previous === undefined) delete process.env.PI_SESSION_FILE
    else process.env.PI_SESSION_FILE = previous
    rm_sync(f.directory, { recursive: true })
  }
})

it('rollback refuses a live writer and preserves converted history', () => {
  const f = fixture()
  try {
    const { manifest } = convert_history(f)
    const file = f.first.replace('.jsonl', '.html.gz')
    write_file_sync(`${file}.writer-${process.pid}`, JSON.stringify({ pid: process.pid, host: hostname() }))
    const before = read_file_sync(file)
    assert.throws(() => rollback_history(manifest), /live writer/)
    assert.deepEqual(read_file_sync(file), before)
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('rollback refuses a changed JSONL collision before changing compressed files', () => {
  const f = fixture()
  try {
    const { manifest } = convert_history(f)
    write_file_sync(f.first, 'another writer changed this file\n')
    const compressed = f.first.replace('.jsonl', '.html.gz')
    const before = read_file_sync(compressed)
    assert.throws(() => rollback_history(manifest), /overwrite a different JSONL/)
    assert.deepEqual(read_file_sync(compressed), before)
    assert.equal(read_file_sync(f.first, 'utf8'), 'another writer changed this file\n')
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('rollback resumes parent mapping after an earlier new session was restored', () => {
  const f = fixture()
  try {
    const { manifest } = convert_history(f)
    const first = f.first.replace('.jsonl', '.html.gz')
    const parent = child_write('create', f.root, first)
    const child = child_write('create', f.root, parent)
    const stored = JSON.parse(read_file_sync(manifest, 'utf8'))
    stored.rollback_files = readdir_sync(f.root)
      .filter(name => name.endsWith('.html.gz'))
      .map(name => ({ target: join(f.root, name), source: join(f.root, name.replace('.html.gz', '.jsonl')) }))
    write_file_sync(manifest, JSON.stringify(stored))
    const decoded = session_html_to_entries(read_session_gzip(read_file_sync(parent)).text)
    decoded[0].parentSession = f.first
    write_file_sync(parent.replace('.html.gz', '.jsonl'), decoded.map(entry => JSON.stringify(entry)).join('\n') + '\n')
    rm_sync(parent)
    rollback_history(manifest)
    const child_header = JSON.parse(read_file_sync(child.replace('.html.gz', '.jsonl'), 'utf8').split('\n')[0])
    assert.equal(child_header.parentSession, parent.replace('.html.gz', '.jsonl'))
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('the trial command rejects symlinks into live history', () => {
  const f = fixture()
  try {
    const linked = join(f.directory, 'linked')
    symlink_sync(resolve(import.meta.dirname, '../../.pi/agent/sessions'), linked)
    const result = spawn_sync(
      process.execPath,
      [resolve(import.meta.dirname, '../../harness/session-format.js'), 'trial-convert', linked, f.backup],
      { encoding: 'utf8', timeout: 20000 }
    )
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must not contain symlinks/)
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('the public trial migrates WAL-backed state and rollback keeps later records', () => {
  const f = fixture()
  const state = join(f.directory, 'state')
  const deferred = join(f.directory, 'deferred.json')
  mkdir_sync(join(state, 'sync'), { recursive: true })
  const db = new DatabaseSync(join(state, 'edits.db'))
  try {
    db.exec(
      'PRAGMA journal_mode = WAL; CREATE TABLE edit (id INTEGER PRIMARY KEY, session TEXT NOT NULL, tool_call TEXT)'
    )
    db.prepare('INSERT INTO edit (session, tool_call) VALUES (?, ?)').run(f.first, 'before')
    const light = '{"skipped":[".pi/agent/sessions/first.jsonl","other.jsonl"]}'
    const pending = {
      'doc.md': {
        base_sha: 'base',
        target_sha: 'target',
        calls: [{ session: 'first.jsonl', tool_call: 'before' }],
        metadata: { session: f.first, negative: -0 }
      }
    }
    write_file_sync(join(state, 'light.json'), light)
    write_file_sync(deferred, stringify_state(pending))
    const baseline = '{"files":{"first.jsonl":{"sha":"old-jsonl-sha","version":"remote-version"}}}'
    write_file_sync(join(state, 'sync', 'history.json'), baseline)
    const run = spawn_sync(
      process.execPath,
      [
        resolve(import.meta.dirname, '../../harness/session-format.js'),
        'trial-convert',
        f.root,
        f.backup,
        state,
        deferred
      ],
      { encoding: 'utf8', timeout: 20000 }
    )
    assert.equal(run.status, 0, run.stderr)
    const { manifest } = JSON.parse(run.stdout)
    const compressed = f.first.replace('.jsonl', '.html.gz')
    assert.equal(db.prepare('SELECT session FROM edit').get().session, compressed)
    const saved = new DatabaseSync(join(f.backup, 'state-originals', 'edits.db'), { readOnly: true })
    try {
      assert.equal(saved.prepare('SELECT session FROM edit').get().session, f.first)
    } finally {
      saved.close()
    }
    const converted = JSON.parse(read_file_sync(deferred, 'utf8'))
    assert.equal(converted['doc.md'].calls[0].session, 'first.html.gz')
    assert.equal(converted['doc.md'].metadata.session, f.first)
    assert.ok(Object.is(converted['doc.md'].metadata.negative, -0))
    assert.equal(
      JSON.parse(read_file_sync(join(state, 'light.json'), 'utf8')).skipped[0],
      '.pi/agent/sessions/first.html.gz'
    )
    assert.equal(read_file_sync(join(state, 'sync', 'history.json'), 'utf8'), baseline)
    const created = child_write('create', f.root, compressed)
    db.prepare('INSERT INTO edit (session, tool_call) VALUES (?, ?)').run(created, 'later')
    converted['new.md'] = {
      base_sha: 'new-base',
      target_sha: 'new-target',
      calls: [{ session: created, tool_call: 'later' }]
    }
    write_file_sync(deferred, stringify_state(converted))
    rollback_history(manifest)
    assert.deepEqual(
      db
        .prepare('SELECT session, tool_call FROM edit ORDER BY id')
        .all()
        .map(row => ({ ...row })),
      [
        { session: f.first, tool_call: 'before' },
        { session: created.replace('.html.gz', '.jsonl'), tool_call: 'later' }
      ]
    )
    const restored = JSON.parse(read_file_sync(deferred, 'utf8'))
    assert.deepEqual(restored['doc.md'], pending['doc.md'])
    assert.equal(restored['new.md'].calls[0].session, created.replace('.html.gz', '.jsonl'))
    assert.equal(read_file_sync(join(state, 'light.json'), 'utf8'), light)
    assert.equal(read_file_sync(join(state, 'sync', 'history.json'), 'utf8'), baseline)
  } finally {
    db.close()
    rm_sync(f.directory, { recursive: true })
  }
})

it('invalid pending state fails before any history is retired', () => {
  const f = fixture()
  try {
    const deferred = join(f.directory, 'deferred.json')
    write_file_sync(deferred, '{invalid')
    assert.throws(() => convert_history({ ...f, deferred }), SyntaxError)
    assert.equal(read_file_sync(f.first, 'utf8'), f.original)
    assert.ok(!readdir_sync(f.directory).includes('backup'))
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('state database symlinks are refused before history changes', () => {
  const f = fixture()
  try {
    const state = join(f.directory, 'state')
    mkdir_sync(state)
    symlink_sync(f.first, join(state, 'edits.db'))
    assert.throws(() => convert_history({ ...f, state }), /must not be a symlink/)
    assert.equal(read_file_sync(f.first, 'utf8'), f.original)
  } finally {
    rm_sync(f.directory, { recursive: true })
  }
})

it('the public trial command refuses live-history paths', () => {
  const result = spawn_sync(
    process.execPath,
    [
      resolve(import.meta.dirname, '../../harness/session-format.js'),
      'trial-convert',
      resolve(import.meta.dirname, '../../.pi/agent/sessions'),
      resolve(import.meta.dirname, '../../artifacts/session-migration/refused')
    ],
    { encoding: 'utf8', timeout: 20000 }
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Trials must stay inside/)
})
