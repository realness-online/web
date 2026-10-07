import {
  cpSync as cp_sync,
  mkdirSync as mkdir_sync,
  rmSync as rm_sync
} from 'node:fs'

rm_sync('dist', { recursive: true, force: true })
mkdir_sync('dist')
for (const file of [
  'index.html',
  'main.js',
  'stream.js',
  'palette.css',
  'style.css',
  'fonts'
])
  cp_sync(file, `dist/${file}`, { recursive: true })
// The terminal ships as its own modules, drawn into this page.
const terminal = '../terminal'
mkdir_sync('dist/terminal/themes', { recursive: true })
for (const file of [
  'terminal.js',
  'ghostty-vt.js',
  'render-canvas.js',
  'themes/subliminal.js'
])
  cp_sync(`${terminal}/src/${file}`, `dist/terminal/${file}`)
cp_sync(`${terminal}/public/ghostty-vt.wasm`, 'dist/terminal/ghostty-vt.wasm')
