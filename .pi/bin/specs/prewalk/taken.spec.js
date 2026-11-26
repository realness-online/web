import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cap_of, local_of, marked_at, meters_from, starts_from, weighted, week_of } from '../../prewalk/taken.js'

test('a turn is weighted as the cap counts it', () => {
  assert.equal(weighted({ input: 100, output: 50, cache_read: 1000, cache_write: 40 }), 300)
})

test('prewalk takes a session at its first log entry', () => {
  const entry = (session, at) =>
    `<article itemscope><span itemprop="session">${session}</span><time itemprop="at" datetime="${at}"></time></article>`
  const starts = starts_from(entry('s1', '2026-11-20T02:00:00Z') + entry('s1', '2026-11-20T01:00:00Z'))
  assert.equal(starts.get('s1'), Date.parse('2026-11-20T01:00:00Z'))
})

test('a session page marks when prewalk took it', () => {
  const html =
    '<article itemscope itemtype="/sessions/custom" itemid="/sessions/s1/a"><span itemprop="customType">prewalk</span><div itemprop="data" itemscope></div><span itemprop="timestamp">2026-11-25T01:00:00.000Z</span></article>'
  assert.equal(marked_at(html), Date.parse('2026-11-25T01:00:00.000Z'))
  assert.equal(marked_at('<main></main>'), 0)
})

test('a session page gives back its weekly meter marks', () => {
  const html =
    '<article itemscope itemtype="/sessions/custom" itemid="/sessions/s1/b"><span itemprop="customType">cap-meter</span><div itemprop="data" itemscope><span itemprop="billing">sub</span><data itemprop="used" value="0.42"></data><data itemprop="reset" value="1795000000"></data></div><span itemprop="timestamp">2026-11-25T01:00:00.000Z</span></article>'
  assert.deepEqual(meters_from(html), [
    { at: Date.parse('2026-11-25T01:00:00.000Z'), billing: 'sub', used: 0.42, reset: '1795000000' }
  ])
})

test('a reset adds a second meter to the week', () => {
  assert.equal(cap_of({ a: 1, b: 0.2 }), 1.2)
})

test('a week starts when the cap resets, Tuesday 10 am Pacific', () => {
  assert.equal(week_of(local_of(Date.parse('2026-11-24T17:59:00Z'))), '2026-11-17')
  assert.equal(week_of(local_of(Date.parse('2026-11-24T18:00:00Z'))), '2026-11-24')
})
