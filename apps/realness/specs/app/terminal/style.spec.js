import { wasm_bytes } from './wasm.js'
import { load_engine } from '#root/src/app/terminal/ghostty-vt.js'

const engine = await load_engine(wasm_bytes)

const flags_of = (text, index = 0) => {
  const term = engine.terminal(20, 2)
  term.write(text)
  return term.frame().rows_data[0].cells[index].flags
}

describe('cell style flags', () => {
  it('reads bold, italic, faint, inverse and strikethrough', () => {
    const flags = flags_of('\x1b[1;3;2;7;9mX')
    expect(flags.bold).toBe(true)
    expect(flags.italic).toBe(true)
    expect(flags.faint).toBe(true)
    expect(flags.inverse).toBe(true)
    expect(flags.strikethrough).toBe(true)
    expect(flags.blink).toBe(false)
    expect(flags.underline).toBe(0)
  })

  it('reads the underline style from the flag bits', () => {
    expect(flags_of('\x1b[4mX').underline).toBe(1)
    expect(flags_of('\x1b[21mX').underline).toBe(2)
    expect(flags_of('\x1b[4:3mX').underline).toBe(3)
  })

  it('reads direct and palette colors from the style', () => {
    const direct = flags_of('\x1b[38;2;18;52;86;48;2;1;2;3mX').fg_color
    expect(direct).toEqual([18, 52, 86])
    const palette = flags_of('\x1b[31mX').fg_color
    expect(palette).toEqual({ palette: 1 })
    expect(flags_of('X').fg_color).toBe(null)
  })
})
