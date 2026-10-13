import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comment_ranges } from './lib/comments.js'

const wav = (text, ext) => comment_ranges(text, ext)

test('a plain comment is not kept', () => {
  const found = wav('const a = 1\n// why\nconst b = 2\n', '.js')
  assert.equal(found.length, 1)
  assert.equal(found[0].keep, false)
})

test('jsdoc is kept', () => {
  const found = wav('/** @returns {number} */\nconst a = () => 1\n', '.js')
  assert.equal(found[0].keep, true)
})

test('a tool directive is kept', () => {
  const found = wav('// eslint-disable-next-line no-console\nconsole.log(1)\n', '.js')
  assert.equal(found[0].keep, true)
})

test('a shebang is kept', () => {
  const found = wav('#!/usr/bin/env python3\nprint(1)\n', '.py')
  assert.equal(found[0].keep, true)
})

test('a nested template literal is not read as two comments', () => {
  const found = wav('const url = `a://${x ? `b://${y}` : "c"}`\n', '.js')
  assert.equal(found.length, 0)
})

test('a url in a string is not a comment', () => {
  const found = wav('const href = "https://example.com/x"\n', '.js')
  assert.equal(found.length, 0)
})

test('a shell parameter is not a comment', () => {
  const found = wav('if [ $# -gt 0 ]; then\n  echo hi # real comment\nfi\n', '.sh')
  assert.equal(found.length, 1)
})

test('a heredoc body is not scanned', () => {
  const found = wav('cat <<EOF\n# not a comment\nEOF\n# yes\n', '.sh')
  assert.equal(found.length, 1)
})

test('a block comment in css is not kept', () => {
  const found = wav('/* section */\np { color: red }\n', '.css')
  assert.equal(found[0].keep, false)
})