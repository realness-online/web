import assert from 'node:assert/strict'
import {
  readdir as read_directory,
  readFile as read_file
} from 'node:fs/promises'

const assets = new URL('../dist/assets/', import.meta.url)
const files = (await read_directory(assets)).filter(name =>
  name.endsWith('.css')
)
const css = (
  await Promise.all(files.map(name => read_file(new URL(name, assets), 'utf8')))
).join('\n')

assert.match(
  css,
  /-webkit-user-select:text/,
  'Built CSS must retain Safari text selection in editors'
)
assert.match(
  css,
  /\[itemprop=['"]?statement['"]?\]:not\(\[contenteditable=['"]?true['"]?\]\)\{[^}]*-webkit-user-select:none/,
  'Built CSS must suppress Safari selection on resting touch statements'
)
assert.match(
  css,
  /-webkit-touch-callout:none/,
  'Built CSS must retain touch callout suppression'
)
console.info(
  'Interaction CSS: Safari selection and touch callout rules present'
)
