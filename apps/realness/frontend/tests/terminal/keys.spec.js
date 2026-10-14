import { capture_file, wasm_bytes } from './wasm.js'
import { readFile as read_file } from 'node:fs/promises'
import {
  load_engine,
  KEY,
  paste_encode
} from '../../../src/app/terminal/ghostty-vt.js'

const engine = await load_engine(wasm_bytes)
const term = engine.terminal(120, 30)
term.write(await read_file(capture_file('pi.tui'), 'utf8'))
const encoder = engine.key_encoder(term)
const bytes = text => [...text].map(c => c.charCodeAt(0))

describe('key encoding on a pi screen', () => {
  it.each([
    ['Escape', { key: KEY.ESCAPE }, '\x1b[27u'],
    [
      'Ctrl+C',
      { key: 22, mods: 2, utf8: 'c', unshifted_codepoint: 99 },
      '\x1b[99;5u'
    ],
    [
      'Ctrl+D',
      { key: 23, mods: 2, utf8: 'd', unshifted_codepoint: 100 },
      '\x1b[100;5u'
    ],
    ['Enter', { key: KEY.ENTER }, '\r'],
    ['Tab', { key: KEY.TAB }, '\t'],
    ['Backspace', { key: KEY.BACKSPACE }, '\x7f'],
    ['ArrowUp', { key: KEY.ARROW_UP }, '\x1b[1;1:1A'],
    ['ArrowDown', { key: KEY.ARROW_DOWN }, '\x1b[1;1:1B'],
    ['ArrowRight', { key: KEY.ARROW_RIGHT }, '\x1b[1;1:1C'],
    ['ArrowLeft', { key: KEY.ARROW_LEFT }, '\x1b[1;1:1D']
  ])('%s', (_, event, expected) => {
    expect([...encoder.encode(event)]).toEqual(bytes(expected))
  })

  it.each([
    ['Home', KEY.HOME],
    ['End', KEY.END],
    ['PageUp', KEY.PAGE_UP],
    ['PageDown', KEY.PAGE_DOWN]
  ])('%s encodes', (_, key) => {
    expect(encoder.encode({ key }).length).toBeGreaterThan(0)
  })

  it('wraps bracketed paste', () => {
    const text = new TextDecoder().decode(
      paste_encode(engine, 'hello\nworld', true)
    )
    expect(text.startsWith('\x1b[200~')).toBe(true)
    expect(text.endsWith('\x1b[201~')).toBe(true)
    expect(text).toContain('hello\nworld')
  })

  it('turns plain paste newlines into returns', () => {
    expect(
      new TextDecoder().decode(paste_encode(engine, 'hello\nworld', false))
    ).toBe('hello\rworld')
  })
})
