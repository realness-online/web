#!/usr/bin/env node
/**
 * Fail when source carries a comment that is not JSDoc or a tool directive.
 *
 * @param {string[]} argv - paths to scan, or none for the default roots
 * @returns {void}
 */

import { readFileSync as read_file_sync } from 'node:fs'
import { parse } from 'node:path'
import { comment_ranges, has_parser } from '../lib/comments.js'
import { inside, is_minified, source_files } from '../lib/source-files.js'

/** Folders this check leaves out: vendored, served as is, or scratch. */
const LEFT_OUT = new Set(['vendor', 'public', 'tmp', 'build'])

/** Files written by a tool, checked by their generator rather than by hand. */
const GENERATED = ['apps/realness/src/app/wasm/tracer.js']

const EXT = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.rs',
  '.css',
  '.styl',
  '.scss',
  '.html',
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.lua'
])

const hits = []
const scan = file => {
  if (/\.(test|spec)\.(js|ts|mjs|cjs)$/.test(file) || file.endsWith('.d.ts')) return
  if (GENERATED.some(path => file.endsWith(path))) return
  const text = read_file_sync(file, 'utf8')
  if (text.includes('\0') || is_minified(text)) return
  for (const range of comment_ranges(text, parse(file).ext)) {
    if (range.keep) continue
    const raw = text.slice(range.start, range.end)
    const line = text.slice(0, range.start).split('\n').length
    hits.push(`${file}:${line}  comment  ${raw.split('\n')[0].trim().slice(0, 90)}`)
  }
}

const DEFAULTS = [
  'apps/realness',
  'apps/blog',
  'work/seeq-app',
  'work/decision-ontology',
  'work/realness-flex',
  'work/seeq-models',
  'work/site',
  'work/haight-ship',
  'work/nvim',
  'work/kata-machine',
  '.pi/bin',
  'skills',
  '.pi/skills',
  '.pi/extensions'
]
const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS
if (!has_parser())
  console.error('comment-check: @babel/parser and @vue/compiler-sfc not found; JS and Vue are not checked')
for (const target of targets)
  source_files(target, name => EXT.has(parse(name).ext) && !inside(name, LEFT_OUT)).forEach(scan)
hits.forEach(hit => console.log(hit))
console.log(`comments: ${hits.length} hit(s)`)
process.exit(hits.length ? 1 : 0)
