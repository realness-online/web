/**
 * Memory extension test
 *
 * Run: node --test .pi/extensions/memory/index-db.test.js
 *
 * The indexer reads pi's own transcripts, which are personal and huge, so the
 * tests build a small session fixture instead and prove the reader against it.
 * Every assertion here is one that a real bug has already violated: the role
 * column shipped with 3,984 `user` rows and four `assistant`, because nothing
 * checked that a stored row was what its label claimed.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, renameSync, copyFileSync, rmSync } from 'node:fs'
import { spawnSync as spawn_sync } from 'node:child_process'
import { sessionJsonlToHtml } from '../../runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-html.js'
import { compress_session_chunk } from '../../runtime/node_modules/@earendil-works/pi-coding-agent/dist/core/session-gzip.js'
import { join, resolve } from 'node:path'
import { indexSessions, openIndex, readSession, recall, stats, toMatchQuery } from './index-db.js'
process.env.PI_SESSION_READER = resolve(import.meta.dirname, '../../runtime/node_modules/.bin/pi-session-read')

/** A session file with the shapes that matter: a normal pair, two user
 *  messages in a row, a tool-only assistant turn, a failed tool result, a
 *  thinking block, and a message with no searchable text at all. */
/**
 * @param {string} dir
 * @returns {string}
 */
const writeFixture = dir => {
  const file = join(dir, '2026-09-18T00-00-00-000Z_fixture.jsonl')
  const lines = [
    {
      type: 'session',
      version: 3,
      id: 'fixture-session',
      cwd: '/home/person/realness/work/realness'
    },
    {
      type: 'message',
      id: 'u1',
      timestamp: '2026-09-18T00:00:01.000Z',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'how do we fix the landscape poster crash'
          }
        ]
      }
    },
    {
      type: 'message',
      id: 'a1',
      timestamp: '2026-09-18T00:00:02.000Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking: 'internal reasoning that must not be indexed'
          },
          {
            type: 'text',
            text: 'The gesture is fighting pinch-zoom; the fix is in as-figure.vue.'
          }
        ]
      }
    },
    {
      type: 'message',
      id: 't1',
      timestamp: '2026-09-18T00:00:03.000Z',
      message: {
        role: 'toolResult',
        toolName: 'bash',
        isError: false,
        content: [
          {
            type: 'text',
            text: 'unremarkable success output'
          }
        ]
      }
    },
    {
      type: 'message',
      id: 'u2',
      timestamp: '2026-09-18T00:00:04.000Z',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'and can you confirm the fix with a test'
          }
        ]
      }
    },
    {
      type: 'message',
      id: 'u3',
      timestamp: '2026-09-18T00:00:05.000Z',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'no not that one, the other one'
          }
        ]
      }
    },
    {
      type: 'message',
      id: 'a2',
      timestamp: '2026-09-18T00:00:06.000Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'c1',
            name: 'read',
            arguments: {
              path: 'src/components/posters/as-figure.vue'
            }
          }
        ]
      }
    },
    {
      type: 'message',
      id: 't2',
      timestamp: '2026-09-18T00:00:07.000Z',
      message: {
        role: 'toolResult',
        toolName: 'read',
        isError: true,
        content: [
          {
            type: 'text',
            text: 'ENOENT: no such file as-figure.vue'
          }
        ]
      }
    }
  ]
  writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + '\n')
  return file
}
/** @returns {string} */
const tempRoot = () => {
  const scratch = join(process.cwd(), 'artifacts', 'memory')
  mkdirSync(scratch, {
    recursive: true
  })
  const dir = mkdtempSync(join(scratch, 'memory-test-'))
  mkdirSync(dir, {
    recursive: true
  })
  return dir
}
test('readSession pairs a question with its answer as one row', async () => {
  const root = tempRoot()
  const file = writeFixture(root)
  const turns = await readSession(file)
  const pair = turns.find(t => t.turn_id === 'u1')
  assert.ok(pair, 'the user turn should be indexed')
  assert.match(pair.text, /landscape poster crash/, 'the question is in the row')
  assert.match(pair.text, /as-figure\.vue/, 'the answer is in the same row')
  assert.equal(pair.project, '/home/person/realness/work/realness')
  assert.equal(pair.ts, '2026-09-18T00:00:01.000Z')
})
test('HTML sessions preserve turns and recall after replacing JSONL', async () => {
  const root = tempRoot()
  const file = writeFixture(root)
  const path = join(root, 'memory.db')
  const before = await readSession(file)
  await indexSessions({
    root,
    path
  })
  const html_file = file.replace(/\.jsonl$/, '.html')
  writeFileSync(html_file, sessionJsonlToHtml(readFileSync(file, 'utf8'), 'fixture-session'))
  renameSync(file, `${file}.backup`)
  const after = await readSession(html_file)
  assert.deepEqual(
    after,
    before.map(turn => ({
      ...turn,
      session_file: html_file
    }))
  )
  await indexSessions({
    root,
    path,
    full: true
  })
  const hits = recall('landscape poster crash', {
    path
  })
  assert.equal(hits[0].session_file, html_file)
  assert.equal(stats(path).sessions, 1)
  assert.equal(stats(path).turns, before.length)
})
test('compressed appended HTML preserves recall and ignores incomplete tails', async () => {
  const root = tempRoot()
  const file = writeFixture(root)
  const before = await readSession(file)
  const html = sessionJsonlToHtml(readFileSync(file, 'utf8'), 'fixture-session')
  const chunks = html
    .split('\n')
    .filter(Boolean)
    .map(row => compress_session_chunk(`${row}\n`))
  const compressed_file = file.replace(/\.jsonl$/, '.html.gz')
  const partial = compress_session_chunk('unfinished\n').subarray(0, 15)
  writeFileSync(compressed_file, Buffer.concat([...chunks, partial]))
  renameSync(file, `${file}.backup`)
  const bytes = readFileSync(compressed_file)
  const after = await readSession(compressed_file)
  assert.deepEqual(
    after,
    before.map(turn => ({
      ...turn,
      session_file: compressed_file
    }))
  )
  const path = join(root, 'memory.db')
  await indexSessions({
    root,
    path,
    full: true
  })
  assert.equal(
    recall('landscape poster crash', {
      path
    })[0].session_file,
    compressed_file
  )
  assert.equal(stats(path).turns, before.length)
  assert.deepEqual(readFileSync(compressed_file), bytes, 'recall must never repair a live tail')
})
test('HTML indexing ignores an unfinished trailing row', async () => {
  const root = tempRoot()
  const file = writeFixture(root)
  const html_file = file.replace(/\.jsonl$/, '.html')
  const html = sessionJsonlToHtml(readFileSync(file, 'utf8'), 'fixture-session')
  writeFileSync(html_file, `${html}<article itemscope`)
  assert.equal((await readSession(html_file)).length, (await readSession(file)).length)
})
test('installed decoder preserves compressed recall without fork sources', async () => {
  const root = tempRoot()
  const checkout = join(root, 'checkout with spaces')
  const extension = join(checkout, '.pi/extensions/memory')
  mkdirSync(extension, {
    recursive: true
  })
  copyFileSync(join(import.meta.dirname, 'index-db.js'), join(extension, 'index-db.js'))
  const file = writeFixture(checkout)
  const expected = await readSession(file)
  const compressed = file.replace(/\.jsonl$/, '.html.gz')
  const html = sessionJsonlToHtml(readFileSync(file, 'utf8'), 'fixture-session')
  writeFileSync(compressed, compress_session_chunk(html))
  renameSync(file, `${file}.backup`)
  const before = readFileSync(compressed)
  const entry = join(checkout, 'check.mjs')
  writeFileSync(
    entry,
    `
		import { readSession, indexSessions, recall } from './.pi/extensions/memory/index-db.js'
		const file = process.argv[2], path = process.argv[3]
		await indexSessions({ root: process.cwd(), path, full: true })
		process.stdout.write(JSON.stringify({ turns: await readSession(file), hits: recall('landscape poster crash', { path }) }))
	`
  )
  try {
    const result = spawn_sync(process.execPath, [entry, compressed, join(checkout, 'memory.db')], {
      cwd: checkout,
      env: {
        PATH: process.env.PATH,
        PI_SESSION_READER: process.env.PI_SESSION_READER
      },
      encoding: 'utf8',
      timeout: 30_000
    })
    assert.equal(result.status, 0, result.stderr)
    const actual = JSON.parse(result.stdout)
    assert.deepEqual(
      actual.turns,
      expected.map(turn => ({
        ...turn,
        session_file: compressed
      }))
    )
    assert.equal(actual.hits[0].session_file, compressed)
    assert.deepEqual(readFileSync(compressed), before)
  } finally {
    rmSync(root, {
      recursive: true,
      force: true
    })
  }
})
test('decoder failures surface instead of silently indexing zero turns', async () => {
  const root = tempRoot()
  const reader = process.env.PI_SESSION_READER
  const file = join(root, 'broken.html.gz')
  writeFileSync(file, 'not gzip')
  try {
    await assert.rejects(readSession(file))
    delete process.env.PI_SESSION_READER
    await assert.rejects(readSession(file), /PI_SESSION_READER is required/)
  } finally {
    process.env.PI_SESSION_READER = reader
    rmSync(root, {
      recursive: true,
      force: true
    })
  }
})
test('nothing records who spoke', async () => {
  const root = tempRoot()
  const turns = await readSession(writeFixture(root))
  for (const turn of turns) {
    assert.deepEqual(
      Object.keys(turn).sort(),
      ['project', 'session_file', 'session_id', 'text', 'ts', 'turn_id'],
      'a turn has no role field'
    )
  }
})
test('thinking, successful tool output, and empty messages are dropped', async () => {
  const root = tempRoot()
  const turns = await readSession(writeFixture(root))
  const all = turns.map(t => t.text).join('\n')
  assert.doesNotMatch(all, /internal reasoning/, 'thinking is not indexed')
  assert.doesNotMatch(all, /unremarkable success output/, 'success output is not indexed')
  assert.doesNotMatch(all, /^\s*$/, 'no empty rows')
})
test('a failed tool result is indexed on its own', async () => {
  const root = tempRoot()
  const turns = await readSession(writeFixture(root))
  const failure = turns.find(t => t.turn_id === 't2')
  assert.ok(failure, 'a failed tool result gets its own row')
  assert.match(failure.text, /read/, 'the tool is named')
  assert.match(failure.text, /ENOENT/, 'the error is searchable')
  const steer = turns.find(t => t.turn_id === 'u3')
  assert.ok(steer)
  assert.doesNotMatch(steer.text, /ENOENT/, 'an error does not attach to the next question')
})
test('a tool call contributes its target', async () => {
  const root = tempRoot()
  const turns = await readSession(writeFixture(root))
  const readRow = turns.find(t => t.text.includes('src/components/posters/as-figure.vue'))
  assert.ok(readRow, 'the path is searchable')
})
test('two user messages in a row stay two rows', async () => {
  const root = tempRoot()
  const turns = await readSession(writeFixture(root))
  const u2 = turns.find(t => t.turn_id === 'u2')
  const u3 = turns.find(t => t.turn_id === 'u3')
  assert.ok(u2 && u3, 'both user turns are indexed')
  assert.doesNotMatch(u2.text, /not that one/, 'a steer does not merge into the previous ask')
})
test('the stored schema has no role column and no role index', () => {
  const root = tempRoot()
  const path = join(root, 'memory.db')
  const db = openIndex(path)
  try {
    const columns = /** @type {Array<{ name: string; }>} */ (db.prepare('PRAGMA table_info(turn)').all()).map(
      c => c.name
    )
    assert.deepEqual(columns.sort(), ['project', 'session_file', 'session_id', 'text', 'ts', 'turn_id'])
    assert.ok(!columns.includes('role'), 'the removed column stays removed')
    const indexes = /** @type {Array<{ name: string; }>} */ (db.prepare('PRAGMA index_list(turn)').all()).map(
      i => i.name
    )
    assert.ok(!indexes.some(n => n.includes('role')), 'no index survives on a column that is gone')
  } finally {
    db.close()
  }
})
test('toMatchQuery survives punctuation a person actually types', () => {
  assert.equal(toMatchQuery('what did we decide about firecracker?'), '"decide" OR "about" OR "firecracker"')
  assert.equal(
    toMatchQuery('fix(bug) in as-figure.vue'),
    '"fix" OR "bug" OR "figure" OR "vue"',
    'punctuation does not throw and stop words drop'
  )
  assert.equal(toMatchQuery('a an the'), null, 'stop words alone match nothing')
  assert.equal(toMatchQuery(''), null)
  assert.equal(toMatchQuery('firecra', true), '"firecra*"', 'partial marks the last token only')
})
test('recall ranks a turn from a real session file', async () => {
  const root = tempRoot()
  writeFixture(root)
  const path = join(root, 'memory.db')
  const first = await indexSessions({
    root,
    path
  })
  assert.equal(first.indexed, 1, 'the fixture is indexed')
  assert.ok(first.turns > 0, 'the fixture has turns')
  const hits = recall('landscape poster crash', {
    path,
    limit: 5,
    partial: true
  })
  assert.ok(hits.length > 0, 'the question is findable')
  assert.match(hits[0].text, /landscape/, 'the top hit is the right turn')
  assert.equal(hits[0].session_id, 'fixture-session')
  assert.ok(hits[0].session_file.endsWith('.jsonl'), 'the hit points at a real file')
})
test('indexing is incremental and skips unmoved files', async () => {
  const root = tempRoot()
  const file = writeFixture(root)
  const path = join(root, 'memory.db')
  const first = await indexSessions({
    root,
    path
  })
  assert.equal(first.indexed, 1)
  const second = await indexSessions({
    root,
    path
  })
  assert.equal(second.scanned, first.scanned, 'every file is still scanned')
  assert.ok(second.indexed <= first.indexed, 'nothing is re-read on a second run')
  const before = stats(path).turns
  assert.ok(before > 0)
})
test('a re-run does not duplicate turns', async () => {
  const root = tempRoot()
  writeFixture(root)
  const path = join(root, 'memory.db')
  await indexSessions({
    root,
    path
  })
  const first = stats(path).turns
  await indexSessions({
    root,
    path,
    full: true
  })
  const second = stats(path).turns
  assert.equal(second, first, 'a full rebuild replaces rather than appends')
})
test('the index holds no copy of transcript content beyond the turn table', async () => {
  const root = tempRoot()
  writeFixture(root)
  const path = join(root, 'memory.db')
  await indexSessions({
    root,
    path
  })
  const db = openIndex(path)
  try {
    const tables = /** @type {Array<{ name: string; }>} */ (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    ).map(t => t.name)
    assert.deepEqual(
      tables.filter(t => !t.startsWith('turn_fts')).sort(),
      ['index_meta', 'session_file', 'turn'],
      'only the turn table stores text; fts is external-content'
    )
    const fts = /** @type {{ sql: string; }} */ (
      db.prepare("SELECT sql FROM sqlite_master WHERE name='turn_fts'").get()
    )
    assert.match(fts.sql, /content\s*=\s*'turn'/, 'fts5 stores an index, not content')
  } finally {
    db.close()
  }
})
