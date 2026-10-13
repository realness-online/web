import { load_engine } from '../../../src/terminal/ghostty-vt.js'

const WASM = new URL('../public/ghostty-vt.wasm', import.meta.url)
const engine = await load_engine(WASM)

const term = engine.terminal(40, 10)
const lines = Array.from(
  { length: 30 },
  (_, i) => `line ${String(i).padStart(2, '0')} content`
)
term.write(`${lines.join('\r\n')}\r\n`)

const checks = {}
const first_row = term.screen_text().split('\n')[0]

term.select_range(0, 0, 4, 0)
checks.selection_range = term.selection_text() === first_row.slice(0, 5)
checks.selection_value = term.selection_text()

term.select_all()
checks.select_all = term.selection_text().includes('line 29 content')

const bar = term.scrollbar()
checks.scrollbar_total = bar !== null && bar.total > 10
checks.scrollbar_len = bar !== null && bar.len === 10
checks.scrollbar_offset = bar !== null && bar.offset === bar.total - bar.len

const bottom = term.screen_text().split('\n').filter(Boolean).slice(-1)[0]
term.scroll(-10)
const scrolled = term.screen_text().split('\n')[0]
checks.scroll_changed = scrolled !== first_row
checks.scroll_value = scrolled
term.scroll_to_bottom()
const restored = term.screen_text().split('\n').filter(Boolean).slice(-1)[0]
checks.scroll_restored = restored === bottom

term.clear_scrollback()
const after_clear = term.scrollbar()
checks.clear_scrollback =
  after_clear !== null && after_clear.total === after_clear.len

let ok = true
for (const [name, pass] of Object.entries(checks)) {
  if (name.endsWith('_value')) {
    console.log(`     ${name}: ${JSON.stringify(pass)}`)
    continue
  }
  if (!pass) ok = false
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}`)
}
console.log(
  ok ? 'PASS: selection and scrollback' : 'FAIL: selection and scrollback'
)
process.exit(ok ? 0 : 1)
