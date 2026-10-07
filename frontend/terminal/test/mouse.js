// Mouse tracking: Pi's fullscreen TUI turns it on, so the wheel goes to Pi.
// Run: node mouse.js
import { load_engine } from '../src/ghostty-vt.js'

const engine = await load_engine(
  new URL('../public/ghostty-vt.wasm', import.meta.url)
)
const term = engine.terminal(80, 24)
const write = text => term.write(new TextEncoder().encode(text))

const checks = { off_at_start: !term.mouse_tracking() }
write('\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1006h')
checks.on_after_pi_enables = term.mouse_tracking()
write('\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[?1049l')
checks.off_after_pi_exits = !term.mouse_tracking()

const failed = Object.entries(checks).filter(([, ok]) => !ok)
for (const [name, ok] of Object.entries(checks))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
process.exit(failed.length ? 1 : 0)
