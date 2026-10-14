import { readFileSync as read_file_sync } from 'node:fs'
import { vi } from 'vite-plus/test'
import { parse_theme } from '../../../src/app/terminal/themes/ghostty-theme.js'
import { terminal_file, wasm_bytes } from './wasm.js'

const dark = parse_theme(
  read_file_sync(terminal_file('themes/realness-dark'), 'utf8')
)

/** Mount options that skip fetching the engine and theme. */
export const mount_options = {
  wasm_url: wasm_bytes,
  focus: false,
  scheme: { matches: true, addEventListener() {}, removeEventListener() {} },
  load_theme: async () => dark
}

/**
 * A canvas stage plus stubbed browser globals. Timers queue instead of
 * running, so a spec decides when a reconnect fires.
 */
export const make_stage = () => {
  const active = { activeElement: null }
  const ctx = new Proxy(
    { measureText: () => ({ width: 8 }) },
    {
      get: (target, key) => (key in target ? target[key] : () => {}),
      set: (target, key, value) => ((target[key] = value), true)
    }
  )
  const canvas = {
    getContext: () => ctx,
    listeners: {},
    addEventListener: (type, fn) => (canvas.listeners[type] = fn),
    removeEventListener: type => delete canvas.listeners[type],
    focus: () => {
      active.activeElement = canvas
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
    style: {}
  }
  ctx.canvas = canvas
  const output = { textContent: '' }
  const stage = {
    clientWidth: 800,
    clientHeight: 400,
    style: {},
    querySelector: tag => (tag === 'canvas' ? canvas : output)
  }
  const listeners = new Set()
  const by_type = new Map()
  const timers = []
  const sockets = []
  vi.stubGlobal('document', {
    baseURI: 'http://host.test/term/',
    get activeElement() {
      return active.activeElement
    },
    querySelector: () => null,
    createElement: () => ({
      style: {},
      setAttribute() {},
      select() {},
      remove() {}
    }),
    execCommand: () => true,
    body: { appendChild() {} }
  })
  vi.stubGlobal('location', {
    protocol: 'http:',
    host: 'host.test',
    search: '',
    href: 'http://host.test/term/'
  })
  vi.stubGlobal('window', {
    addEventListener: (type, fn) => {
      listeners.add(fn)
      if (!by_type.has(type)) by_type.set(type, new Set())
      by_type.get(type).add(fn)
    },
    removeEventListener: (type, fn) => {
      listeners.delete(fn)
      by_type.get(type)?.delete(fn)
    }
  })
  vi.stubGlobal('history', { replaceState() {} })
  const frames = []
  vi.stubGlobal('requestAnimationFrame', fn => (frames.push(fn), frames.length))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('devicePixelRatio', 1)
  vi.stubGlobal('setTimeout', fn => (timers.push(fn), timers.length))
  vi.stubGlobal('clearTimeout', () => {})
  vi.stubGlobal(
    'WebSocket',
    class {
      static OPEN = 1
      readyState = 0
      constructor(url) {
        this.url = url
        sockets.push(this)
      }
      send() {}
      close() {}
    }
  )
  /** Let pending work finish, firing up to `rounds` queued timers. */
  const settle = async (rounds = 10) => {
    for (let i = 0; i < rounds; i++) {
      await new Promise(resolve => setImmediate(resolve))
      const fn = timers.shift()
      if (fn) await fn()
    }
  }
  return {
    stage,
    output,
    canvas,
    listeners,
    by_type,
    /** Fire one window event at the handlers registered for its type. */
    fire: (type, event) => {
      for (const fn of by_type.get(type) ?? []) fn(event)
    },
    /** Fire one event on the canvas, which is where clicks and wheels arrive. */
    fire_canvas: (type, event) => canvas.listeners[type]?.(event),
    /** Run the frame a redraw asked for, so the engine sees what changed. */
    paint: () => {
      for (const fn of frames.splice(0)) fn(0)
    },
    timers,
    sockets,
    settle,
    /** The canvas is the element keys and pastes are read from. */
    focus: () => canvas.focus(),
    is_focused: () => active.activeElement === canvas
  }
}
