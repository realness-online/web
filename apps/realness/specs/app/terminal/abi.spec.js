import { wasm_bytes } from './wasm.js'
import { LAYOUT } from '#root/src/app/terminal/ghostty-vt.js'

const wasm = await WebAssembly.instantiate(wasm_bytes, {
  env: { log: () => {} }
})
const ex = wasm.instance.exports

const type_json = () => {
  const ptr = ex.ghostty_type_json()
  const memory = new Uint8Array(ex.memory.buffer)
  let end = ptr
  while (memory[end] !== 0) end++
  return JSON.parse(new TextDecoder().decode(memory.subarray(ptr, end)))
}

const { types, abi } = type_json()

const enums = {
  result: 'GhosttyResult',
  render_state_data: 'GhosttyRenderStateData',
  render_state_row_data: 'GhosttyRenderStateRowData',
  render_state_row_cells_data: 'GhosttyRenderStateRowCellsData',
  style_color_tag: 'GhosttyStyleColorTag',
  style_flags: 'GhosttyStyleFlags',
  terminal_option: 'GhosttyTerminalOption',
  terminal_data: 'GhosttyTerminalData',
  terminal_scroll_viewport_tag: 'GhosttyTerminalScrollViewportTag',
  formatter_format: 'GhosttyFormatterFormat',
  formatter_option: 'GhosttyFormatterOption',
  point_tag: 'GhosttyPointTag',
  key_action: 'GhosttyKeyAction',
  key: 'GhosttyKey'
}

const structs = {
  style: 'GhosttyStyle',
  style_color: 'GhosttyStyleColor',
  render_state_colors: 'GhosttyRenderStateColors',
  render_state_cursor: 'GhosttyRenderStateCursor',
  render_state_row_selection: 'GhosttyRenderStateRowSelection',
  terminal_scroll_viewport: 'GhosttyTerminalScrollViewport',
  terminal_scrollbar: 'GhosttyTerminalScrollbar',
  point: 'GhosttyPoint',
  grid_ref: 'GhosttyGridRef',
  selection: 'GhosttySelection',
  buffer: 'GhosttyBuffer'
}

const field_offset = (type, ...path) => {
  const [first, ...rest] = path
  const offset = types[type].fields[first].offset
  if (rest.length === 0) return offset
  return offset + field_offset(types[type].fields[first].type, ...rest)
}

const union_paths = {
  'style_color.rgb': () =>
    field_offset('GhosttyStyleColor', 'value') +
    field_offset('GhosttyStyleColorValue', 'rgb'),
  'style_color.palette': () =>
    field_offset('GhosttyStyleColor', 'value') +
    field_offset('GhosttyStyleColorValue', 'palette'),
  'terminal_scroll_viewport.delta': () =>
    field_offset('GhosttyTerminalScrollViewport', 'value') +
    field_offset('GhosttyTerminalScrollViewportValue', 'delta'),
  'point.x': () => field_offset('GhosttyPoint', 'value', 'coordinate', 'x'),
  'point.y': () => field_offset('GhosttyPoint', 'value', 'coordinate', 'y')
}

const checked = new Set()

describe('libghostty-vt ABI layout', () => {
  it('targets 32-bit pointers, so our u32 slots hold a usize', () => {
    expect(abi.usize_size).toBe(4)
  })

  it.each(Object.entries(enums))('%s enums match', (group, type) => {
    const layout = LAYOUT[group]
    if (type === 'GhosttyStyleFlags') {
      const bits = types[type].bits
      for (const [name, lsb] of Object.entries(layout)) {
        if (name === 'underline_width') continue
        expect([name, bits[name].lsb]).toEqual([name, lsb])
      }
      expect(layout.underline_width).toBe(bits.underline.width)
      checked.add('style_flags')
      return
    }
    const values = types[type].values
    for (const [name, value] of Object.entries(layout))
      expect([name, values[name]]).toEqual([name, value])
    checked.add(group)
  })

  it.each(Object.entries(structs))('%s layout matches', (group, type) => {
    const layout = LAYOUT[group]
    const struct = types[type]
    expect(layout.size).toBe(struct.size)
    for (const [name, offset] of Object.entries(layout)) {
      if (name === 'size') continue
      if (!struct.fields[name]) continue
      expect([name, struct.fields[name].offset]).toEqual([name, offset])
      checked.add(`${group}.${name}`)
    }
    checked.add(`${group}.size`)
  })

  it.each(Object.keys(union_paths))('%s matches through its union', path => {
    const [group, name] = path.split('.')
    expect(LAYOUT[group][name]).toBe(union_paths[path]())
    checked.add(path)
  })

  it('checks every value in LAYOUT', () => {
    const uncovered = []
    for (const [group, layout] of Object.entries(LAYOUT))
      for (const name of Object.keys(layout)) {
        const id = `${group}.${name}`
        if (checked.has(id) || checked.has(group)) continue
        uncovered.push(id)
      }
    expect(uncovered).toEqual([])
  })
})
