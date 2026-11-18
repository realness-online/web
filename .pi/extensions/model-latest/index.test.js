import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compare_versions, newest_by_family, parse_id } from './families.js'
import { resolve_target } from './aliases.js'

test('an id splits into family and version', () => {
  assert.deepEqual(parse_id('claude-fable-5-2'), { family: 'claude-fable', version: [5, 2] })
  assert.deepEqual(parse_id('gpt-6.1-sol'), { family: 'gpt-sol', version: [6, 1] })
})

test('snapshots, previews, and latest ids stay out', () => {
  assert.equal(parse_id('claude-opus-4-5-20251101'), null)
  assert.equal(parse_id('gpt-4o-2024-05-13'), null)
  assert.equal(parse_id('gemini-3.1-pro-preview'), null)
  assert.equal(parse_id('gemini-pro-latest'), null)
  assert.equal(parse_id('anthropic/claude-fable-5:batch'), null)
  assert.equal(parse_id('deepseek-flash'), null)
})

test('versions compare by number', () => {
  assert.ok(compare_versions([5, 10], [5, 9]) > 0)
  assert.ok(compare_versions([5], [5, 2]) < 0)
})

test('each family points at its newest version', () => {
  const ids = ['claude-fable-5', 'claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-4-8', 'claude-opus-5-5', 'gpt-5']
  assert.deepEqual(
    newest_by_family(ids),
    new Map([
      ['claude-fable-latest', 'claude-fable-5-2'],
      ['claude-opus-latest', 'claude-opus-5-5']
    ])
  )
})

test('an alias follows its family or names a fixed model', () => {
  const latest = new Map([['anthropic', new Map([['claude-opus-latest', 'claude-opus-5-5']])]])
  assert.equal(resolve_target('anthropic', 'claude-opus-latest', latest), 'claude-opus-5-5')
  assert.equal(
    resolve_target('openrouter', 'deepseek/deepseek-v4.1-flash-1017', latest),
    'deepseek/deepseek-v4.1-flash-1017'
  )
})
