import {
  cpSync as cp_sync,
  mkdirSync as mkdir_sync,
  rmSync as rm_sync
} from 'node:fs'
import { join } from 'node:path'
import { product_paths } from '#root/src/settings/layout.js'

const { chat, terminal, frontend } = product_paths()

rm_sync('dist', { recursive: true, force: true })
mkdir_sync('dist')
for (const file of ['index.html', 'palette.css', 'style.css', 'fonts'])
  cp_sync(file, `dist/${file}`, { recursive: true })
for (const file of ['main.js', 'stream.js'])
  cp_sync(join(chat, file), `dist/${file}`)
mkdir_sync('dist/terminal/themes', { recursive: true })
for (const file of [
  'terminal.js',
  'ghostty-vt.js',
  'render-canvas.js',
  'themes/ghostty-theme.js',
  'themes/realness-light',
  'themes/realness-dark'
])
  cp_sync(join(terminal, file), `dist/terminal/${file}`)
cp_sync(
  join(frontend, 'terminal/public/ghostty-vt.wasm'),
  'dist/terminal/ghostty-vt.wasm'
)
