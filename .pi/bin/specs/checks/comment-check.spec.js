import { it } from 'node:test'
import assert from 'node:assert/strict'
import { comment_ranges } from '../../lib/comments.js'

const wav = (text, ext) => comment_ranges(text, ext)

it('a plain comment is not kept', () => {
  const found = wav('const a = 1\n// why\nconst b = 2\n', '.js')
  assert.equal(found.length, 1)
  assert.equal(found[0].keep, false)
})

it('jsdoc is kept', () => {
  const found = wav('/** @returns {number} */\nconst a = () => 1\n', '.js')
  assert.equal(found[0].keep, true)
})

it('a tool directive is kept', () => {
  const found = wav('// eslint-disable-next-line no-console\nconsole.log(1)\n', '.js')
  assert.equal(found[0].keep, true)
})

it('a shebang is kept', () => {
  const found = wav('#!/usr/bin/env python3\nprint(1)\n', '.py')
  assert.equal(found[0].keep, true)
})

it('a nested template literal is not read as two comments', () => {
  const found = wav('const url = `a://${x ? `b://${y}` : "c"}`\n', '.js')
  assert.equal(found.length, 0)
})

it('a url in a string is not a comment', () => {
  const found = wav('const href = "https://example.com/x"\n', '.js')
  assert.equal(found.length, 0)
})

it('a shell parameter is not a comment', () => {
  const found = wav('if [ $# -gt 0 ]; then\n  echo hi # real comment\nfi\n', '.sh')
  assert.equal(found.length, 1)
})

it('a heredoc body is not scanned', () => {
  const found = wav('cat <<EOF\n# not a comment\nEOF\n# yes\n', '.sh')
  assert.equal(found.length, 1)
})

it('a quoted heredoc body is not scanned', () => {
  for (const open of ["<<'SH'", '<<"SH"', "<<-'SH'"]) {
    const found = wav(`cat > f ${open}\n#!/usr/bin/env bash\n# not a comment\nSH\n# yes\n`, '.sh')
    assert.equal(found.length, 1, open)
  }
})

it('a block comment in css is not kept', () => {
  const found = wav('/* section */\np { color: red }\n', '.css')
  assert.equal(found[0].keep, false)
})
it('jsdoc above what it documents is kept; the same block inside code is not', () => {
  const found = wav(
    '/** file */\nimport a from "a"\n/** sum */\nconst f = () => {\n  /** why */\n  a()\n  return { /** part */ x: 1 }\n}\n',
    '.js'
  )
  assert.deepEqual(
    found.map(range => range.keep),
    [true, true, false, true]
  )
})

it('a tagged block is kept anywhere, as a type cast is', () => {
  const found = wav('const f = () => {\n  const x = /** @type {number} */ (y)\n  return x\n}\n', '.js')
  assert.equal(found[0].keep, true)
})

it('a shell header documents the script; later comments do not', () => {
  const found = wav('#!/usr/bin/env bash\n# what this does\n# usage: x\nset -e\n# why\necho\n', '.sh')
  assert.deepEqual(
    found.map(range => range.keep),
    [true, true, true, false]
  )
})

it('jsdoc above a call that registers a function, or a returned function, is kept', () => {
  const found = wav(
    'const f = () => {\n  /** effect */\n  watch(() => 1)\n  /** runner */\n  return async c => c\n}\n/** suite */\ndescribe("x", () => {})\n',
    '.js'
  )
  assert.deepEqual(
    found.map(range => range.keep),
    [true, true, true]
  )
})
