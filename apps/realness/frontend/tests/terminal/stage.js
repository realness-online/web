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
  const ctx = new Proxy(
    { measureText: () => ({ width: 8 }) },
    {
      get: (target, key) => (key in target ? target[key] : () => {}),
      set: (target, key, value) => ((target[key] = value), true)
    }
  )
  const canvas = {
    getContext: () => ctx,
    addEventListener() {},
    focus() {},
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
  const timers = []
  const sockets = []
  vi.stubGlobal('document', { baseURI: 'http://host.test/term/' })
  vi.stubGlobal('location', {
    protocol: 'http:',
    host: 'host.test',
    search: '',
    href: 'http://host.test/term/'
  })
  vi.stubGlobal('window', {
    addEventListener: (type, fn) => listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn)
  })
  vi.stubGlobal('history', { replaceState() {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
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
  return { stage, output, listeners, timers, sockets, settle }
}
