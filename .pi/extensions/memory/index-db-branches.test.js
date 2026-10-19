import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  fingerprint,
  indexSessions,
  openIndex,
  readSession,
  recall,
  stats,
  toMatchQuery,
} from './index-db.js'

process.env.PI_SESSION_READER = resolve(
  import.meta.dirname,
  '../../runtime/node_modules/.bin/pi-session-read',
)

const scratch = () => {
  const dir = resolve(import.meta.dirname, `../../../artifacts/memory-lines-${process.pid}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

const writeSession = (dir, name, lines) => {
  const file = join(dir, name)
  writeFileSync(file, lines.map(line => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n') + '\n')
  return file
}

const message = (role, content, extra = {}) => ({
  type: 'message',
  id: extra.id,
  timestamp: extra.timestamp ?? '2026-09-18T00:00:01.000Z',
  message: { role, content, ...extra.fields },
})

test('a line that is not JSON is skipped, and a session keeps its id and cwd', async () => {
  const dir = scratch()
  try {
    const file = writeSession(dir, 's.jsonl', [
      'not json at all',
      '{ broken',
      { type: 'session', id: 'kept-id', cwd: '/somewhere/special' },
      message('user', 'a real question', { id: 'u1' }),
      message('assistant', 'a real answer', { id: 'a1' }),
    ])
    const turns = await readSession(file)
    assert.equal(turns.length, 1)
    assert.equal(turns[0].session_id, 'kept-id')
    assert.equal(turns[0].project, '/somewhere/special')
    assert.match(turns[0].text, /a real question/)
    assert.match(turns[0].text, /a real answer/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a turn without ids or timestamps still gets a stable name', async () => {
  const dir = scratch()
  try {
    const file = writeSession(dir, 's.jsonl', [
      message('user', 'no id here'),
      message('assistant', 'and none here'),
    ])
    const turns = await readSession(file)
    assert.equal(turns.length, 1)
    assert.ok(turns[0].turn_id.length > 0)
    assert.equal(turns[0].ts, '2026-09-18T00:00:01.000Z')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an assistant turn with no question before it is indexed on its own', async () => {
  const dir = scratch()
  try {
    const file = writeSession(dir, 's.jsonl', [message('assistant', 'unprompted remark', { id: 'a1' })])
    const turns = await readSession(file)
    assert.equal(turns.length, 1)
    assert.match(turns[0].text, /unprompted remark/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a role the index does not carry is ignored, and a block that is not an object is skipped', async () => {
  const dir = scratch()
  try {
    const file = writeSession(dir, 's.jsonl', [
      message('system', 'system prompt text', { id: 's1' }),
      message('user', [null, 'not a block', { type: 'text', text: 'kept text' }], { id: 'u1' }),
    ])
    const turns = await readSession(file)
    assert.equal(turns.length, 1)
    assert.match(turns[0].text, /kept text/)
    assert.doesNotMatch(turns[0].text, /system prompt text/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('many assistant messages after one question join into a single turn', async () => {
  const dir = scratch()
  try {
    const file = writeSession(dir, 's.jsonl', [
      message('user', 'the question', { id: 'u1' }),
      message('assistant', 'first part', { id: 'a1' }),
      message('assistant', 'second part', { id: 'a2' }),
    ])
    const turns = await readSession(file)
    assert.equal(turns.length, 1)
    assert.match(turns[0].text, /first part\nsecond part/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a tool call names the file, command, or pattern it touched', async () => {
  const dir = scratch()
  try {
    const cases = [
      ['read', { file_path: '/a/b.js' }, '/a/b.js'],
      ['write', { path: '  /c/d.js  ' }, '/c/d.js'],
      ['edit', { path: '/e/f.js' }, '/e/f.js'],
      ['bash', { command: 'ls -la' }, 'ls -la'],
      ['grep', { pattern: 'needle' }, 'needle'],
      ['glob', { pattern: '**/*.vue' }, '**/*.vue'],
      ['project_tooling', { project: 'realness' }, 'realness'],
      ['some_other_tool', { query: 'a query' }, 'a query'],
      ['empty_tool', { path: '   ' }, null],
      ['never_seen', {}, null],
    ]
    for (const [toolName, args, expected] of cases) {
      const file = writeSession(dir, `${toolName}.jsonl`, [
        message('assistant', [{ type: 'toolCall', name: toolName, arguments: args }], { id: 'a1' }),
      ])
      const turns = await readSession(file)
      if (expected === null) {
        assert.equal(turns.length, 1, toolName)
        assert.equal(turns[0].text, toolName)
      } else assert.match(turns[0].text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), toolName)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a very long message is cut to the stored limit', async () => {
  const dir = scratch()
  try {
    const file = writeSession(dir, 'long.jsonl', [message('user', 'x'.repeat(5000), { id: 'u1' })])
    const turns = await readSession(file)
    assert.ok(turns[0].text.length <= 4000, `stored ${turns[0].text.length} chars`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('recall can drop the session asking, so the answer is not the question', async () => {
  const dir = scratch()
  try {
    const root = join(dir, 'sessions')
    mkdirSync(root, { recursive: true })
    writeSession(root, 'old.jsonl', [
      { type: 'session', id: 'old', cwd: '/work/alpha' },
      message('user', 'the journey workflow got fixed', { id: 'o1' }),
    ])
    writeSession(root, 'now.jsonl', [
      { type: 'session', id: 'now', cwd: '/work/alpha' },
      message('user', 'journey workflow journey workflow journey workflow', { id: 'n1' }),
    ])
    const db_path = join(dir, 'memory.db')
    await indexSessions({ root, path: db_path })

    const all = recall('journey workflow', { path: db_path })
    assert.equal(all[0].session_id, 'now', 'without the option, the echoing session wins')
    const hits = recall('journey workflow', { path: db_path, exclude_session: 'now' })
    assert.equal(hits.length, 1)
    assert.equal(hits[0].session_id, 'old')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('toMatchQuery quotes every token, drops stop words, and can prefix the last', () => {
  assert.equal(toMatchQuery(''), null)
  assert.equal(toMatchQuery('the of and'), null)
  assert.equal(toMatchQuery('fix(bug)'), '"fix" OR "bug"')
  assert.equal(toMatchQuery('Fix  FIX  fix'), '"fix"')
  assert.equal(toMatchQuery('firecra', true), '"firecra*"')
  assert.equal(toMatchQuery('landscape poster', true), '"landscape" OR "poster*"')
  assert.equal(toMatchQuery('a bb'), '"bb"')
})

test('recall filters by project and time, and returns nothing for a stop-word query', async () => {
  const dir = scratch()
  try {
    const root = join(dir, 'sessions')
    mkdirSync(root, { recursive: true })
    writeSession(root, 'one.jsonl', [
      { type: 'session', id: 'one', cwd: '/work/alpha' },
      message('user', 'the landscape poster crashed', { id: 'u1', timestamp: '2026-01-01T00:00:00.000Z' }),
      message('assistant', 'fixed in as-figure', { id: 'a1', timestamp: '2026-01-01T00:00:01.000Z' }),
    ])
    writeSession(root, 'two.jsonl', [
      { type: 'session', id: 'two', cwd: '/work/beta' },
      message('user', 'the landscape poster printed', { id: 'u2', timestamp: '2026-06-01T00:00:00.000Z' }),
      message('assistant', 'printed fine', { id: 'a2', timestamp: '2026-06-01T00:00:01.000Z' }),
    ])
    const db_path = join(dir, 'memory.db')
    await indexSessions({ root, path: db_path })

    assert.equal(recall('the of and', { path: db_path }).length, 0)
    assert.equal(recall('landscape', { path: db_path }).length, 2)
    assert.equal(recall('landscape', { path: db_path, project: 'alpha' }).length, 1)
    assert.equal(recall('landscape', { path: db_path, since: '2026-05-01' }).length, 1)
    assert.equal(recall('landscape', { path: db_path, limit: 1 }).length, 1)

    const [first] = recall('landscape', { path: db_path })
    assert.match(first.text, /\*\*landscape\*\*/)
    assert.equal(typeof first.turn_id, 'string')
    assert.equal(typeof first.session_file, 'string')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('indexSessions reports progress and a rebuild start', async () => {
  const dir = scratch()
  try {
    const root = join(dir, 'sessions')
    mkdirSync(root, { recursive: true })
    writeSession(root, 'one.jsonl', [
      message('user', 'a question about indexing', { id: 'u1' }),
      message('assistant', 'an answer', { id: 'a1' }),
    ])
    const db_path = join(dir, 'memory.db')
    const seen = []
    await indexSessions({ root, path: db_path, onProgress: (done, total, file) => seen.push([done, total, typeof file]) })
    assert.ok(seen.length >= 1)
    assert.equal(seen[0][1], 1)
    assert.equal(seen[0][2], 'string')

    // A rebuild drops what is no longer on disk.
    rmSync(join(root, 'one.jsonl'))
    await indexSessions({ root, path: db_path, full: true })
    assert.equal(recall('indexing', { path: db_path }).length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('stats report zero for a missing file, then real counts', async () => {
  const dir = scratch()
  try {
    const missing = join(dir, 'nothing.db')
    assert.deepEqual(stats(missing), { path: missing, turns: 0, sessions: 0, bytes: 0 })

    const root = join(dir, 'sessions')
    mkdirSync(root, { recursive: true })
    writeSession(root, 'one.jsonl', [
      message('user', 'counted question', { id: 'u1' }),
      message('assistant', 'counted answer', { id: 'a1' }),
    ])
    const db_path = join(dir, 'memory.db')
    await indexSessions({ root, path: db_path })
    const reported = stats(db_path)
    assert.equal(reported.turns, 1)
    assert.equal(reported.sessions, 1)
    assert.ok(reported.bytes > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a fingerprint is stable, short, and differs by path', () => {
  const one = fingerprint('/a/b/c.jsonl')
  assert.equal(one, fingerprint('/a/b/c.jsonl'))
  assert.equal(one.length, 12)
  assert.notEqual(one, fingerprint('/a/b/d.jsonl'))
})

test('the index file is created at the path it is asked for', () => {
  const dir = scratch()
  try {
    const db_path = join(dir, 'explicit.db')
    const db = openIndex(db_path)
    db.close()
    assert.ok(readFileSync(db_path).length > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})