import assert from 'node:assert/strict'
import { test } from 'node:test'
import { flag_of, week_of } from '../../checks/read-limits.js'

const read = (extra = '') =>
  `</span><div itemprop="arguments" itemscope><span itemprop="path">a.js</span>${extra}</div></div>`

test('a read with a limit is not flagged', () => {
  assert.equal(
    flag_of('read', read('<data itemprop="offset" value="1"></data><data itemprop="limit" value="40"></data>')),
    null
  )
})

test('a read taken whole is flagged', () => {
  assert.equal(flag_of('read', read('<data itemprop="limit" value="null"></data>')), 'whole file')
  assert.equal(flag_of('read', read()), 'whole file')
})

test('a cat call is flagged where a command starts', () => {
  const bash = command => `<pre itemprop="command">${command}</pre>`
  assert.equal(flag_of('bash', bash('cat a.js')), 'cat')
  assert.equal(flag_of('bash', bash('cd app; cat a.js')), 'cat')
  assert.equal(flag_of('bash', bash('rg "cat" src')), null)
  assert.equal(flag_of('bash', bash('npm run cat')), null)
})

test('other tools are not flagged', () => {
  assert.equal(flag_of('grep', read()), null)
})

test('weeks start on Tuesday, Pacific', () => {
  assert.equal(week_of(new Date('2026-11-17T12:00:00.000Z')), '2026-11-17')
  assert.equal(week_of(new Date('2026-11-16T20:00:00.000Z')), '2026-11-10')
})
