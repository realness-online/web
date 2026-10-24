import { terminal_file, wasm_bytes } from './wasm.js'
import { readFileSync as read_file_sync } from 'node:fs'
import {
  load_engine,
  apply_theme
} from '../../../src/app/terminal/ghostty-vt.js'
import { parse_theme } from '../../../src/app/terminal/themes/ghostty-theme.js'

const engine = await load_engine(wasm_bytes)
const hex = (text, key) =>
  new RegExp(`^${key}\\s*=?\\s*#(\\w{6})$`, 'm')
    .exec(text)[1]
    .match(/../g)
    .map(c => parseInt(c, 16))
const rgb = color => color.slice(0, 3)

describe('realness terminal themes', () => {
  it.each(['light', 'dark'])('%s applies to the engine', scheme => {
    const text = read_file_sync(
      terminal_file(`themes/realness-${scheme}`),
      'utf8'
    )
    const theme = parse_theme(text)
    const term = engine.terminal(80, 24)
    apply_theme(term, theme)
    const { colors } = term.frame()
    expect(rgb(colors.background)).toEqual(hex(text, 'background'))
    expect(rgb(colors.foreground)).toEqual(hex(text, 'foreground'))
    expect(rgb(colors.cursor)).toEqual(hex(text, 'cursor-color'))
    expect(rgb(colors.palette[1])).toEqual(hex(text, 'palette = 1='))
    expect(rgb(colors.palette[15])).toEqual(hex(text, 'palette = 15='))
    expect(rgb(colors.palette[16])).not.toEqual([0, 0, 0])
    expect(rgb(colors.palette[255])).not.toEqual([0, 0, 0])
    expect(Array.isArray(theme.selection_background)).toBe(true)
  })

  it('refuses an incomplete theme', () => {
    expect(() => parse_theme('background = #000000\n')).toThrow()
  })
})
