import { readFile as read_file } from 'node:fs/promises'
import {
  load_engine,
  KEY,
  paste_encode
} from '../../../src/terminal/ghostty-vt.js'

const WASM = new URL('../public/ghostty-vt.wasm', import.meta.url)
const engine = await load_engine(WASM)

const capture_file =
  process.argv[2] || new URL('./capture/pi.tui', import.meta.url)
const term = engine.terminal(120, 30)
term.write(await read_file(capture_file, 'utf8'))

const encoder = engine.key_encoder(term)

const hex = bytes =>
  [...bytes].map(b => b.toString(16).padStart(2, '0')).join(' ')
const show = (label, bytes) => console.log(`${label.padEnd(12)} ${hex(bytes)}`)

const cases = [
  ['Escape', { key: KEY.ESCAPE }],
  ['Ctrl+C', { key: 22, mods: 2, utf8: 'c', unshifted_codepoint: 99 }],
  ['Ctrl+D', { key: 23, mods: 2, utf8: 'd', unshifted_codepoint: 100 }],
  ['Enter', { key: KEY.ENTER }],
  ['Tab', { key: KEY.TAB }],
  ['Backspace', { key: KEY.BACKSPACE }],
  ['ArrowUp', { key: KEY.ARROW_UP }],
  ['ArrowDown', { key: KEY.ARROW_DOWN }],
  ['ArrowLeft', { key: KEY.ARROW_LEFT }],
  ['ArrowRight', { key: KEY.ARROW_RIGHT }],
  ['Home', { key: KEY.HOME }],
  ['End', { key: KEY.END }],
  ['PageUp', { key: KEY.PAGE_UP }],
  ['PageDown', { key: KEY.PAGE_DOWN }]
]

const encoded = {}
for (const [label, event] of cases) {
  encoded[label] = encoder.encode(event)
  show(label, encoded[label])
}

const paste_bracketed = paste_encode(engine, 'hello\nworld', true)
const paste_plain = paste_encode(engine, 'hello\nworld', false)
show('Paste[]', paste_bracketed)
show('Paste', paste_plain)

const eq = (bytes, expected) =>
  bytes.length === expected.length && expected.every((b, i) => bytes[i] === b)
const checks = {
  Escape: eq(encoded.Escape, [0x1b, 0x5b, 0x32, 0x37, 0x75]),
  'Ctrl+C': eq(encoded['Ctrl+C'], [0x1b, 0x5b, 0x39, 0x39, 0x3b, 0x35, 0x75]),
  'Ctrl+D': eq(
    encoded['Ctrl+D'],
    [0x1b, 0x5b, 0x31, 0x30, 0x30, 0x3b, 0x35, 0x75]
  ),
  Enter: eq(encoded.Enter, [0x0d]),
  Tab: eq(encoded.Tab, [0x09]),
  Backspace: eq(encoded.Backspace, [0x7f]),
  ArrowUp: eq(
    encoded.ArrowUp,
    [0x1b, 0x5b, 0x31, 0x3b, 0x31, 0x3a, 0x31, 0x41]
  ),
  ArrowDown: eq(
    encoded.ArrowDown,
    [0x1b, 0x5b, 0x31, 0x3b, 0x31, 0x3a, 0x31, 0x42]
  ),
  ArrowRight: eq(
    encoded.ArrowRight,
    [0x1b, 0x5b, 0x31, 0x3b, 0x31, 0x3a, 0x31, 0x43]
  ),
  ArrowLeft: eq(
    encoded.ArrowLeft,
    [0x1b, 0x5b, 0x31, 0x3b, 0x31, 0x3a, 0x31, 0x44]
  ),
  bracketed_paste_wrapped: (() => {
    const s = new TextDecoder().decode(paste_bracketed)
    return (
      s.startsWith('\x1b[200~') &&
      s.endsWith('\x1b[201~') &&
      s.includes('hello\nworld')
    )
  })(),
  plain_paste_newlines: new TextDecoder().decode(paste_plain) === 'hello\rworld'
}

let ok = true
for (const [name, pass] of Object.entries(checks)) {
  if (!pass) ok = false
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}`)
}
console.log(
  ok ? 'PASS: key and paste encoding' : 'FAIL: key and paste encoding'
)
process.exit(ok ? 0 : 1)
