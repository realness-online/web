import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parse_row } from './lib.js'

test('parse_row splits cells', () => {
  assert.deepEqual(parse_row('a, b'), ['a', 'b'])
})
