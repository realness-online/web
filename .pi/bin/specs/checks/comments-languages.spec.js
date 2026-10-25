import { it } from 'node:test'
import assert from 'node:assert/strict'
import { comment_ranges, has_parser } from '../../lib/comments.js'

const ranges = (text, ext) => comment_ranges(text, ext)
const kept = (text, ext) => ranges(text, ext).map(range => range.keep)
const bodies = (text, ext) => ranges(text, ext).map(range => text.slice(range.start, range.end))

it('the parsers are installed, so JS and Vue are really checked', () => {
  assert.equal(has_parser(), true)
})

it('lua keeps a doc comment and ignores long-bracket strings', () => {
  assert.deepEqual(kept('--- why\nlocal a = 1\n', '.lua'), [true])
  assert.deepEqual(kept('-- why\nlocal a = 1\n', '.lua'), [false])
  assert.deepEqual(ranges('local s = [[-- not a comment]]\n', '.lua'), [])
  assert.deepEqual(ranges('local s = [==[ -- still not ]==]\n', '.lua'), [])
  assert.deepEqual(ranges('local s = "-- not a comment"\n', '.lua'), [])
  const long = ranges('--[[\nnot kept\n]]\nlocal a = 1\n', '.lua')
  assert.equal(long.length, 1)
  assert.equal(long[0].keep, false)
  assert.deepEqual(ranges('--[[a]] local b = 1\n--[==[ b ]==]\n', '.lua').length, 2)
})

it('rust keeps doc comments and reads raw strings', () => {
  assert.deepEqual(kept('/// why\nfn a() {}\n', '.rs'), [true])
  assert.deepEqual(kept('//! why\nfn a() {}\n', '.rs'), [true])
  assert.deepEqual(kept('// why\nfn a() {}\n', '.rs'), [false])
  assert.deepEqual(ranges('let s = r#"// not a comment"#;\n', '.rs'), [])
  assert.deepEqual(ranges('let s = br##"// nope"##;\n', '.rs'), [])
  assert.deepEqual(ranges("let c = '/'; let a = 1;\n", '.rs'), [])
  assert.deepEqual(ranges("let c = '\\n';\n", '.rs'), [])
  const nested = ranges('/* outer /* inner */ still outer */\nfn a() {}\n', '.rs')
  assert.equal(nested.length, 1)
  assert.equal(nested[0].keep, false)
})

it('python reads triple-quoted text and tool directives', () => {
  assert.deepEqual(ranges('s = """# not a comment"""\n', '.py'), [])
  assert.deepEqual(ranges("s = '''# not a comment'''\n", '.py'), [])
  assert.deepEqual(ranges('s = """unterminated\n', '.py'), [])
  assert.deepEqual(kept('# type: ignore\nx = 1\n', '.py'), [true])
  assert.deepEqual(kept('# noqa\ny = 2\n', '.py'), [true])
  assert.deepEqual(kept('# just a note\nz = 3\n', '.py'), [false])
  assert.deepEqual(kept('#!/usr/bin/env python3\n', '.py'), [true])
})

it('stylus and scss line comments are read, css line comments are not', () => {
  assert.deepEqual(kept('// why\np\n  color red\n', '.styl'), [false])
  assert.deepEqual(kept('// why\np { color: red }\n', '.scss'), [false])
  assert.deepEqual(ranges('// not a comment\np { color: red }\n', '.css'), [])
  assert.deepEqual(ranges('a { content: "/* nope */" }\n', '.css'), [])
  assert.deepEqual(ranges("a { content: '/* nope */' }\n", '.css'), [])
  assert.deepEqual(kept('/* keep */\n', '.scss'), [false])
})

it('html comments are found, and a vue file reads each block', () => {
  assert.deepEqual(kept('<!-- why -->\n<p>a</p>\n', '.html'), [false])
  const vue = `<template>\n  <!-- inside -->\n  <p>a</p>\n</template>\n<script setup>\n  // why\n  const a = 1\n</script>\n<style lang="stylus">\n// styled\np\n  color red\n</style>\n`
  const found = bodies(vue, '.vue')
  assert.equal(found.length, 3)
  assert.ok(found.some(one => one.includes('<!-- inside -->')))
  assert.ok(found.some(one => one.includes('// why')))
  assert.ok(found.some(one => one.includes('// styled')))
  assert.deepEqual(kept(vue, '.vue'), [false, false, false])
})

it('a vue file keeps markup comments outside its blocks', () => {
  const vue = '<!-- outside -->\n<template><p>a</p></template>\n'
  assert.deepEqual(kept(vue, '.vue'), [false])
})

it('js tool directives are kept, by their first line or their body', () => {
  const directives = [
    '// eslint-env node',
    '// oxlint-ignore x',
    '// tslint:disable',
    '// tslint:ignore x',
    '// deno-lint-ignore no-explicit-any',
    '// @ts-expect-error',
    '// @jsx h',
    '// @vue-ignore',
    '// webpackChunkName: "x"',
    '// @sourceMappingURL=a.map',
    '// @license MIT',
    '/* globals foo */',
    '// DO NOT EDIT',
    '// istanbul ignore next',
    '// prettier-ignore',
    '// shellcheck disable=SC2015',
    '// @vitest-environment node',
    '// #region one',
    '// #endregion',
    '/// <reference types="node" />',
    '// soundness-allow: reason',
    '// @flow',
    '// @jest-environment node',
    '/*! banner */'
  ]
  for (const line of directives) assert.deepEqual(kept(`${line}\nconst a = 1\n`, '.js'), [true], line)
  assert.deepEqual(kept('// just prose\nconst a = 1\n', '.js'), [false])
})

it('jsx and typescript extensions use their own parser', () => {
  assert.deepEqual(kept('const a = <p>{x}</p> // why\n', '.jsx'), [false])
  assert.deepEqual(kept('const a: number = 1 // why\n', '.ts'), [false])
  assert.deepEqual(kept('const a = <p>x</p> // why\n', '.tsx'), [false])
  assert.deepEqual(ranges('const s = "// not a comment"\n', '.ts'), [])
})

it('a shell script reads quotes, escapes, and tab-stripped heredocs', () => {
  assert.deepEqual(ranges('echo "a # b"\n', '.sh'), [])
  assert.deepEqual(ranges("echo 'a # b'\n", '.sh'), [])
  assert.deepEqual(ranges('echo a \\# b\n', '.sh'), [])
  const after_command = ranges('a=1 # after a parameter\n', '.sh')
  assert.equal(after_command.length, 1)
  assert.equal(after_command[0].keep, false)
  const tabbed = bodies('cat <<-EOF\n\t# not a comment\n\tEOF\n# yes\n', '.sh')
  assert.deepEqual(tabbed.length, 1)
  assert.ok(tabbed[0].startsWith('# yes'))
  assert.deepEqual(bodies('cat <<EOF\n# body\n', '.sh'), [])
  assert.deepEqual(kept('#!/bin/sh\n', '.sh'), [true])
})

it('an unknown extension is read as javascript', () => {
  assert.deepEqual(kept('// why\n', '.wat'), [false])
  assert.deepEqual(kept('/** kept */\n', '.wat'), [true])
})
