import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { indexSessions, recall, stats } from './index-db.js'
import { is_past, month_html, read_month, sealed_months } from './months.js'

const now = new Date('2026-10-26T12:00:00Z')

const scratch = () => {
  const base = join(process.cwd(), 'artifacts', 'memory')
  mkdirSync(base, { recursive: true })
  return mkdtempSync(join(base, 'months-'))
}

const session = (dir, name, id, words) => {
  mkdirSync(dir, { recursive: true })
  const lines = [
    { type: 'session', version: 3, id, cwd: '/r' },
    {
      type: 'message',
      id: `${id}-u`,
      timestamp: `${name.slice(0, 10)}T00:00:01.000Z`,
      message: { role: 'user', content: [{ type: 'text', text: words }] }
    },
    {
      type: 'message',
      id: `${id}-a`,
      timestamp: `${name.slice(0, 10)}T00:00:02.000Z`,
      message: { role: 'assistant', content: [{ type: 'text', text: 'noted' }] }
    }
  ]
  writeFileSync(join(dir, name), lines.map(line => JSON.stringify(line)).join('\n') + '\n')
}

test('m0: only months already over are past', () => {
  assert.ok(is_past('2026-09-30T23-00-00-000Z_x.html.gz', now))
  assert.ok(!is_past('2026-10-01T00-00-00-000Z_x.html.gz', now))
  assert.ok(!is_past('notes.jsonl', now))
})

test('m0: rows round-trip, sorted by id, text escaped', () => {
  const rows = [
    { turn_id: 'b', session_id: 's', session: 'x.jsonl', project: '/p', ts: 't', text: 'two\n<b>"&' },
    { turn_id: 'a', session_id: 's', session: 'x.jsonl', project: '/p', ts: 't', text: 'one' }
  ]
  const html = month_html(rows, 1)
  assert.equal(html, month_html([...rows].reverse(), 1), 'order does not matter')
  const { gzipSync } = process.getBuiltinModule('node:zlib')
  const back = read_month(gzipSync(html))
  assert.equal(back.sessions, 1)
  assert.deepEqual(back.rows.map(row => row.turn_id), ['a', 'b'])
  assert.equal(back.rows[1].text, 'two\n<b>"&')
})

test('m0: a past month seals; a new device recalls it with no sessions', async () => {
  const root = scratch()
  const laptop = join(root, 'laptop')
  session(join(laptop, 'sessions'), '2026-09-02T00-00-00-000Z_old.jsonl', 'old', 'sealed lighthouse question')
  session(join(laptop, 'sessions'), '2026-10-02T00-00-00-000Z_new.jsonl', 'new', 'current harbor question')
  await indexSessions({ root: join(laptop, 'sessions'), path: join(laptop, 'memory.db'), now })
  const months = join(laptop, 'memory', 'turns')
  assert.deepEqual([...sealed_months(months).keys()], ['2026-09'], 'this month stays open')
  const first = readFileSync(join(months, '2026-09.turns.html.gz'))
  await indexSessions({ root: join(laptop, 'sessions'), path: join(laptop, 'memory.db'), now })
  assert.deepEqual(readFileSync(join(months, '2026-09.turns.html.gz')), first, 'idle when sealed')

  const fresh = join(root, 'fresh')
  mkdirSync(join(fresh, 'sessions'), { recursive: true })
  cpSync(join(laptop, 'memory'), join(fresh, 'memory'), { recursive: true })
  await indexSessions({ root: join(fresh, 'sessions'), path: join(fresh, 'memory.db'), now })
  const hits = recall('lighthouse', { path: join(fresh, 'memory.db') })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].session_file, join(fresh, 'sessions', '2026-09-02T00-00-00-000Z_old.jsonl'))
  assert.equal(stats(join(fresh, 'memory.db')).sessions, 1)
  await indexSessions({ root: join(fresh, 'sessions'), path: join(fresh, 'memory.db'), now })
  assert.deepEqual(readFileSync(join(fresh, 'memory', 'turns', '2026-09.turns.html.gz')), first, 'fewer sessions never reseal')
  rmSync(root, { recursive: true, force: true })
})

test('m0: a late session reseals its month', async () => {
  const root = scratch()
  const sessions = join(root, 'sessions')
  session(sessions, '2026-09-02T00-00-00-000Z_a.jsonl', 'a', 'first anchor')
  await indexSessions({ root: sessions, path: join(root, 'memory.db'), now })
  session(sessions, '2026-09-20T00-00-00-000Z_b.jsonl', 'b', 'late arrival')
  await indexSessions({ root: sessions, path: join(root, 'memory.db'), now })
  const { sessions: count, rows } = read_month(readFileSync(join(root, 'memory', 'turns', '2026-09.turns.html.gz')))
  assert.equal(count, 2)
  assert.deepEqual(rows.map(row => row.turn_id), ['a-u', 'b-u'])
  rmSync(root, { recursive: true, force: true })
})
