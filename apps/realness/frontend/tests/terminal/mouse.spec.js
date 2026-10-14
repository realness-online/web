import { wasm_bytes } from './wasm.js'
import { load_engine } from '../../../src/app/terminal/ghostty-vt.js'

const engine = await load_engine(wasm_bytes)

describe('mouse tracking', () => {
  it('follows the modes pi turns on and off', () => {
    const term = engine.terminal(80, 24)
    const write = text => term.write(new TextEncoder().encode(text))
    expect(term.mouse_tracking()).toBe(false)
    write('\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1006h')
    expect(term.mouse_tracking()).toBe(true)
    write('\x1b[?1002l\x1b[?1000l\x1b[?1006l\x1b[?1049l')
    expect(term.mouse_tracking()).toBe(false)
  })
})
