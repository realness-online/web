import { readFileSync as read_file_sync } from 'node:fs'
import { mount } from '../../../src/app/terminal/terminal.js'
import { parse_theme } from '../../../src/app/terminal/themes/ghostty-theme.js'
import { make_stage, mount_options } from './stage.js'
import { terminal_file } from './wasm.js'

/** Mount a terminal with a socket that records what is sent. */
const open_terminal = async env => {
  const sent = []
  await mount(env.stage, {
    ...mount_options,
    open: async () => new WebSocket('wss://gate.test/pty')
  })
  await env.settle()
  const [socket] = env.sockets
  socket.readyState = 1
  socket.send = data => sent.push(JSON.parse(data))
  return { socket, sent }
}

const key = (env, init) => {
  const event = new KeyboardEvent('keydown', init)
  env.fire('keydown', event)
  return event
}

describe('terminal keyboard and clipboard', () => {
  let env
  beforeEach(() => {
    env = make_stage()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends a letter as its own bytes', async () => {
    const { sent } = await open_terminal(env)
    env.focus()
    key(env, { key: 'a' })
    expect(sent).toHaveLength(1)
    expect(atob(sent[0].data_b64)).toBe('a')
  })

  it('sends Ctrl+C as its control code, not as a letter', async () => {
    const { sent } = await open_terminal(env)
    env.focus()
    key(env, { key: 'c', ctrlKey: true })
    expect(sent).toHaveLength(1)
    expect(atob(sent[0].data_b64)).toBe('\x03')
  })

  it('encodes named keys and their modifiers', async () => {
    const { sent } = await open_terminal(env)
    env.focus()
    key(env, { key: 'Enter' })
    key(env, { key: 'ArrowUp', shiftKey: true })
    expect(sent).toHaveLength(2)
    expect(atob(sent[0].data_b64)).toBe('\r')
    expect(atob(sent[1].data_b64).length).toBeGreaterThan(0)
  })

  it('ignores keys when the canvas is not focused', async () => {
    const { sent } = await open_terminal(env)
    key(env, { key: 'a' })
    expect(sent).toHaveLength(0)
  })

  it('leaves browser shortcuts alone', async () => {
    const { sent } = await open_terminal(env)
    env.focus()
    key(env, { key: 'r', metaKey: true })
    expect(sent).toHaveLength(0)
  })

  it('selects across cells with the mouse and copies on Cmd+C', async () => {
    const written = []
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: async text => {
          written.push(text)
        }
      }
    })
    const { sent } = await open_terminal(env)
    env.sockets[0].onmessage({
      data: JSON.stringify({
        op: 'data',
        data_b64: btoa('hello world\r\n')
      })
    })
    await env.settle(1)
    expect(window.realness.screen_text()).toContain('hello world')

    const at = (column, row) => ({
      clientX: column * 8,
      clientY: row * 20,
      buttons: 1
    })
    env.fire_canvas('mousedown', at(0, 0))
    env.fire('mousemove', at(4, 0))
    env.fire('mouseup', {})
    env.paint()
    const selected = window.realness.selection_text()
    expect(selected).toBe('hello')

    key(env, { key: 'c', metaKey: true })
    await Promise.resolve()
    await Promise.resolve()
    expect(written).toEqual(['hello'])
    expect(sent.every(one => one.op === 'data')).toBe(true)
  })

  it('pastes as text, bracketed only when the program asked', async () => {
    const { sent } = await open_terminal(env)
    env.focus()
    const paste = text => {
      const event = new Event('paste')
      event.clipboardData = { getData: () => text }
      env.fire('paste', event)
      return event
    }
    paste('hello')
    expect(sent).toHaveLength(1)
    expect(atob(sent[0].data_b64)).toBe('hello')
  })

  it('sends nothing once the socket is no longer open', async () => {
    const { socket, sent } = await open_terminal(env)
    env.focus()
    socket.readyState = 3
    key(env, { key: 'a' })
    expect(sent).toHaveLength(0)
  })
})

describe('terminal connection messages', () => {
  let env
  beforeEach(() => {
    env = make_stage()
  })
  afterEach(() => vi.unstubAllGlobals())

  const receive = (env, message) =>
    env.sockets[0].onmessage({ data: JSON.stringify(message) })

  it('closes the socket when the program exits, and stops taking keys', async () => {
    const { socket, sent } = await open_terminal(env)
    env.focus()
    let closed = false
    socket.close = () => {
      closed = true
      socket.readyState = 3
    }
    receive(env, { op: 'exit', code: 3 })
    expect(closed).toBe(true)
    key(env, { key: 'a' })
    expect(sent).toHaveLength(0)
  })

  it('leaves a screen open elsewhere alone until it is clicked', async () => {
    await open_terminal(env)
    let closed = 0
    env.sockets[0].close = () => (closed += 1)
    receive(env, { op: 'taken' })
    expect(closed).toBe(1)
    env.sockets[0].close = () => (closed += 1)
    env.fire_canvas('click', {})
    expect(closed).toBe(1)
  })

  it('ignores a message op it does not know', async () => {
    await open_terminal(env)
    receive(env, { op: 'nonsense' })
    expect(env.output.textContent).toBe('')
  })

  it('turns bracketed paste on and off from the program output', async () => {
    const { sent } = await open_terminal(env)
    env.focus()
    receive(env, { op: 'data', data_b64: btoa('\x1b[?2004h') })
    const paste = text => {
      const event = new Event('paste')
      event.clipboardData = { getData: () => text }
      env.fire('paste', event)
    }
    paste('one')
    receive(env, { op: 'data', data_b64: btoa('\x1b[?2004l') })
    paste('two')
    const frames = sent.map(one => atob(one.data_b64))
    expect(frames[0]).toBe('\x1b[200~one\x1b[201~')
    expect(frames[1]).toBe('two')
  })

  it('never reconnects once the program has exited', async () => {
    await open_terminal(env)
    const sockets_before = env.sockets.length
    receive(env, { op: 'exit', code: 0 })
    env.sockets[0].onclose()
    await env.settle()
    expect(env.sockets).toHaveLength(sockets_before)
  })
})

describe('terminal scroll, resize, and theme', () => {
  let env
  beforeEach(() => {
    env = make_stage()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reports wheel movement to a program that wants the mouse', async () => {
    const { sent } = await open_terminal(env)
    const terminal = window.realness
    env.sockets[0].onmessage({
      data: JSON.stringify({
        op: 'data',
        data_b64: btoa('\x1b[?1000h\x1b[?1006h')
      })
    })
    env.paint()
    env.fire_canvas('wheel', {
      deltaY: 60,
      deltaMode: 0,
      clientX: 0,
      clientY: 0,
      preventDefault() {}
    })
    const reports = sent
      .map(one => atob(one.data_b64))
      .filter(text => text.includes('\x1b[<'))
    expect(reports.length).toBeGreaterThan(0)
    expect(reports[0]).toMatch(/^\x1b\[<6[45];1;1M$/)
    expect(terminal.scrollbar()).not.toBeUndefined()
  })

  it('scrolls the view when the program does not want the mouse', async () => {
    await open_terminal(env)
    const before = window.realness.screen_text()
    env.fire_canvas('wheel', {
      deltaY: -60,
      deltaMode: 0,
      clientX: 0,
      clientY: 0,
      preventDefault() {}
    })
    env.paint()
    expect(window.realness.screen_text()).toBe(before)
  })

  it('resizes the terminal only when the cell counts change', async () => {
    await open_terminal(env)
    const { sent } = await open_terminal(env)
    env.stage.clientWidth = 400
    env.stage.clientHeight = 200
    env.fire('resize', {})
    await env.settle()
    const resizes = sent.filter(one => one.op === 'resize')
    expect(resizes.length).toBeGreaterThan(0)
    const before = resizes.length
    env.fire('resize', {})
    await env.settle()
    expect(sent.filter(one => one.op === 'resize')).toHaveLength(before)
  })

  it('repaints with the new theme when the color scheme changes', async () => {
    let dark = false
    const scheme = {
      matches: false,
      listeners: new Set(),
      addEventListener(type, fn) {
        this.listeners.add(fn)
      },
      removeEventListener(type, fn) {
        this.listeners.delete(fn)
      }
    }
    let themed = 0
    await mount(env.stage, {
      ...mount_options,
      scheme,
      load_theme: async () => {
        themed += 1
        return parse_theme(
          read_file_sync(terminal_file('themes/realness-dark'), 'utf8')
        )
      }
    })
    await env.settle()
    expect(themed).toBe(1)
    dark = true
    for (const fn of scheme.listeners) fn({ matches: dark })
    await env.settle()
    expect(themed).toBe(2)
  })
})
