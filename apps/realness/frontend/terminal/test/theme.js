import { readFileSync as read_file_sync } from 'node:fs'
import { load_engine, apply_theme } from '../../../src/terminal/ghostty-vt.js'
import { parse_theme } from '../../../src/terminal/themes/ghostty-theme.js'

const WASM = new URL('../public/ghostty-vt.wasm', import.meta.url)
const engine = await load_engine(WASM)

const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
const hex = (text, key) =>
  new RegExp(`^${key}\\s*=?\\s*#(\\w{6})$`, 'm')
    .exec(text)[1]
    .match(/../g)
    .map(c => parseInt(c, 16))

let ok = true
for (const scheme of ['light', 'dark']) {
  const text = read_file_sync(
    new URL(`../../../src/terminal/themes/realness-${scheme}`, import.meta.url),
    'utf8'
  )
  const theme = parse_theme(text)
  const term = engine.terminal(80, 24)
  apply_theme(term, theme)
  const { colors } = term.frame()
  const checks = {
    background: eq(colors.background, hex(text, 'background')),
    foreground: eq(colors.foreground, hex(text, 'foreground')),
    cursor: eq(colors.cursor, hex(text, 'cursor-color')),
    palette_1: eq(colors.palette[1], hex(text, 'palette = 1=')),
    palette_15: eq(colors.palette[15], hex(text, 'palette = 15=')),
    palette_generated:
      !eq(colors.palette[16], [0, 0, 0]) && !eq(colors.palette[255], [0, 0, 0]),
    selection: Array.isArray(theme.selection_background)
  }
  for (const [name, pass] of Object.entries(checks)) {
    if (!pass) ok = false
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${scheme} ${name}`)
  }
}
let refused = false
try {
  parse_theme('background = #000000\n')
} catch {
  refused = true
}
if (!refused) ok = false
console.log(`${refused ? 'ok  ' : 'FAIL'} an incomplete theme is refused`)
console.log(ok ? 'PASS: realness themes' : 'FAIL: realness themes')
process.exit(ok ? 0 : 1)
