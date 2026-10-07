// Theme data path: Subliminal's fg/bg/cursor and palette reach the render state.
// Run: node theme.js
import { load_engine, apply_theme } from '../src/ghostty-vt.js'
import { subliminal } from '../src/themes/subliminal.js'

const WASM = new URL('../public/ghostty-vt.wasm', import.meta.url)
const engine = await load_engine(WASM)

const term = engine.terminal(80, 24)
apply_theme(term, subliminal)
const { colors } = term.frame()

const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
const checks = {
  background: eq(colors.background, [0x28, 0x2c, 0x35]),
  foreground: eq(colors.foreground, [0xd4, 0xd4, 0xd4]),
  cursor: eq(colors.cursor, [0xc7, 0xc7, 0xc7]),
  palette_1: eq(colors.palette[1], [0xe1, 0x5a, 0x60]),
  palette_15: eq(colors.palette[15], [0xd4, 0xd4, 0xd4]),
  palette_generated:
    !eq(colors.palette[16], [0, 0, 0]) && !eq(colors.palette[255], [0, 0, 0])
}

let ok = true
for (const [name, pass] of Object.entries(checks)) {
  if (!pass) ok = false
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}`)
}
console.log(ok ? 'PASS: subliminal theme' : 'FAIL: subliminal theme')
process.exit(ok ? 0 : 1)
