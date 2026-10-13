import { readFile as read_file } from 'node:fs/promises'

const WASM = new URL('../public/ghostty-vt.wasm', import.meta.url)
const wasm = await WebAssembly.instantiate(await read_file(WASM), {
  env: { log: () => {} }
})
const ex = wasm.instance.exports

/** A NUL-terminated UTF-8 string from wasm memory. */
const cstr = (ptr, max = 1 << 20) => {
  const view = new Uint8Array(
    ex.memory.buffer,
    ptr,
    Math.min(max, ex.memory.buffer.byteLength - ptr)
  )
  const end = view.indexOf(0)
  return new TextDecoder().decode(end === -1 ? view : view.subarray(0, end))
}

const layout = JSON.parse(cstr(ex.ghostty_type_json()))
const { SUCCESS } = layout.types.GhosttyResult.values
const { PLAIN } = layout.types.GhosttyFormatterFormat.values

const bytes = () => new Uint8Array(ex.memory.buffer)
const view = (ptr, len) => new DataView(ex.memory.buffer, ptr, len)

/** A size_t value from wasm memory. */
const usize = ptr => {
  const v = view(ptr, 8)
  return layout.abi.usize_size === 8
    ? Number(v.getBigUint64(0, true))
    : v.getUint32(0, true)
}

/** Set a struct field by name, layout offsets from ghostty_type_json. */
const set_field = (v, struct, name, value) => {
  const field = layout.types[struct].fields[name]
  switch (field.type) {
    case 'u8':
    case 'bool':
      v.setUint8(field.offset, value)
      break
    case 'u16':
      v.setUint16(field.offset, value, true)
      break
    case 'u32':
      v.setUint32(field.offset, value, true)
      break
    case 'u64':
      v.setBigUint64(field.offset, BigInt(value), true)
      break
    default: {
      const type = layout.types[field.type]
      if (type?.kind === 'enum' && type.underlying === 'i32') {
        v.setInt32(field.offset, value, true)
        break
      }
      throw new Error(`unsupported field type: ${field.type}`)
    }
  }
}

const check = (result, what) => {
  if (result !== SUCCESS) throw new Error(`${what} -> ${result}`)
}

const new_terminal = (cols, rows) => {
  const slot = ex.ghostty_wasm_alloc_opaque()
  check(ex.ghostty_terminal_new(0, slot, cols, rows), 'terminal_new')
  const term = ex.ghostty_wasm_take_opaque(slot)
  ex.ghostty_wasm_free_opaque(slot)
  return term
}

const write = (term, text) => {
  const data = new TextEncoder().encode(text)
  const ptr = ex.ghostty_wasm_alloc(data.length)
  bytes().set(data, ptr)
  ex.ghostty_terminal_vt_write(term, ptr, data.length)
  ex.ghostty_wasm_free(ptr, data.length)
}

/** One GhosttyTerminalData value: uint16 for cols/rows/cursor. */
const get = (term, data) => {
  const ptr = ex.ghostty_wasm_alloc(2)
  check(ex.ghostty_terminal_get(term, data, ptr), 'terminal_get')
  const value = view(ptr, 2).getUint16(0, true)
  ex.ghostty_wasm_free(ptr, 2)
  return value
}

const format_plain = term => {
  const opts_size = layout.types.GhosttyFormatterTerminalOptions.size
  const opts = ex.ghostty_wasm_alloc(opts_size)
  bytes().fill(0, opts, opts + opts_size)
  const opts_view = view(opts, opts_size)
  set_field(opts_view, 'GhosttyFormatterTerminalOptions', 'size', opts_size)
  set_field(opts_view, 'GhosttyFormatterTerminalOptions', 'emit', PLAIN)
  set_field(opts_view, 'GhosttyFormatterTerminalOptions', 'unwrap', 0)
  set_field(opts_view, 'GhosttyFormatterTerminalOptions', 'trim', 1)
  const extra = layout.types.GhosttyFormatterTerminalOptions.fields.extra.offset
  set_field(
    opts_view,
    'GhosttyFormatterTerminalExtra',
    'size',
    layout.types.GhosttyFormatterTerminalExtra.size
  )
  const extra_size = layout.types.GhosttyFormatterTerminalExtra.size
  const extra_field = layout.types.GhosttyFormatterTerminalExtra.fields.size
  const screen_field = layout.types.GhosttyFormatterTerminalExtra.fields.screen
  opts_view.setUint32(extra + extra_field.offset, extra_size, true)
  opts_view.setUint32(
    extra +
      screen_field.offset +
      layout.types.GhosttyFormatterScreenExtra.fields.size.offset,
    layout.types.GhosttyFormatterScreenExtra.size,
    true
  )

  const fmt_slot = ex.ghostty_wasm_alloc_opaque()
  check(
    ex.ghostty_formatter_terminal_new(0, fmt_slot, term, opts),
    'formatter_terminal_new'
  )
  ex.ghostty_wasm_free(opts, opts_size)
  const fmt = ex.ghostty_wasm_take_opaque(fmt_slot)
  ex.ghostty_wasm_free_opaque(fmt_slot)

  const out_slot = ex.ghostty_wasm_alloc_opaque()
  const len_ptr = ex.ghostty_wasm_alloc(layout.abi.usize_size)
  check(
    ex.ghostty_formatter_format_alloc(fmt, 0, out_slot, len_ptr),
    'formatter_format_alloc'
  )
  const out = ex.ghostty_wasm_take_opaque(out_slot)
  const len = usize(len_ptr)
  const text = new TextDecoder().decode(
    new Uint8Array(ex.memory.buffer, out, len)
  )
  ex.ghostty_free(0, out, len)
  ex.ghostty_wasm_free_opaque(out_slot)
  ex.ghostty_wasm_free(len_ptr, layout.abi.usize_size)
  ex.ghostty_formatter_free(fmt)
  return text
}

const capture_file = process.argv[2]
if (capture_file) {
  const captured = await read_file(capture_file, 'utf8')
  const term = new_terminal(120, 30)
  write(term, captured)
  const text = format_plain(term)
  console.log(text)
  const ok =
    text.includes('pi') &&
    /v0\.\d+\.\d+/.test(text) &&
    text.includes('interrupt')
  console.log(
    ok ? 'PASS: parsed a captured pi TUI stream' : 'FAIL: pi screen not found'
  )
  process.exit(ok ? 0 : 1)
}

const primary = [
  'first line\r\n',
  '\x1b[1;32mgreen bold\x1b[0m and \x1b[4munderline\x1b[0m\r\n',
  '\x1b[3;1H\x1b[2Kthird line erased first',
  '\x1b[s\x1b[10;20Hcursor here\x1b[u'
].join('')
const alt = '\x1b[?1049hALT SCREEN\x1b[5;3Hat 5,3'

const term = new_terminal(80, 24)
write(term, primary)
const data = layout.types.GhosttyTerminalData.values
const primary_cursor = [get(term, data.CURSOR_X), get(term, data.CURSOR_Y)]
const primary_text = format_plain(term)

write(term, alt)
const alt_cursor = [get(term, data.CURSOR_X), get(term, data.CURSOR_Y)]
const alt_text = format_plain(term)

console.log(primary_text)
console.log('---')
console.log(alt_text)
console.log('---')
console.log(`cursor primary ${primary_cursor} alt ${alt_cursor}`)
const ok =
  primary_text.includes('green bold') &&
  primary_text.includes('underline') &&
  primary_text.includes('third line erased first') &&
  alt_text.includes('ALT SCREEN') &&
  alt_text.includes('at 5,3') &&
  primary_cursor[0] === 23 &&
  primary_cursor[1] === 2 &&
  alt_cursor[0] === 8 &&
  alt_cursor[1] === 4
console.log(
  ok ? 'PASS: parsed, formatted, cursor read' : 'FAIL: unexpected screen'
)
process.exit(ok ? 0 : 1)
