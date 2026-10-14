import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strip_tags } from '../../../tools/publish/renderer/src/markdown.js'

test('plain text extracted from rendered HTML decodes entities once', () => {
  assert.equal(strip_tags('<h1>A &amp; B &lt;C&gt;</h1>'), 'A & B <C>')
})
