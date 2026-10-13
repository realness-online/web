const theme_options = {
  scheme: { matches: true, addEventListener() {}, removeEventListener() {} },
  load_theme: async () => {
    const { parse_theme } =
      await import('../../../src/terminal/themes/ghostty-theme.js')
    const { readFileSync } = await import('node:fs')
    return parse_theme(
      readFileSync(
        new URL('../../../src/terminal/themes/realness-dark', import.meta.url),
        'utf8'
      )
    )
  }
}
const ctx = new Proxy(
  { measureText: () => ({ width: 8 }), canvas: { style: {} } },
  {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: () => true
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

globalThis.document = { baseURI: 'http://host.test/term/' }
globalThis.location = {
  protocol: 'http:',
  host: 'host.test',
  search: '',
  href: 'http://host.test/term/'
}
const listeners = new Set()
globalThis.window = {
  addEventListener: (type, fn) => listeners.add(fn),
  removeEventListener: (type, fn) => listeners.delete(fn)
}
globalThis.cancelAnimationFrame = () => {}
globalThis.history = { replaceState() {} }
globalThis.requestAnimationFrame = () => 0
globalThis.devicePixelRatio = 1
const timers = []
globalThis.setTimeout = fn => (timers.push(fn), timers.length)
globalThis.clearTimeout = () => {}

const sockets = []
globalThis.WebSocket = class {
  static OPEN = 1
  readyState = 0
  constructor(url) {
    this.url = url
    sockets.push(this)
  }
  send() {}
  close() {}
}

const { mount } = await import('../../../src/terminal/terminal.js')
const wasm_url = new URL('../public/ghostty-vt.wasm', import.meta.url)
const settle = async () => {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setImmediate(resolve))
    const fn = timers.shift()
    if (fn) await fn()
  }
}

globalThis.fetch = async () => {
  throw new Error('no ticket fetch with open')
}
const asked = []
const opened = await mount(stage, {
  ...theme_options,
  focus: false,
  wasm_url,
  open: async size => (asked.push(size), new WebSocket('wss://gate.test/pty'))
})
await settle()
const before_close = listeners.size
let closed_socket = false
sockets[0].close = () => (closed_socket = true)
opened.close()
const after_close = listeners.size

sockets.length = 0
timers.length = 0
let tries = 0
await mount(stage, {
  ...theme_options,
  focus: false,
  wasm_url,
  open: async () => {
    tries++
    throw Object.assign(new Error('401'), { status: 401 })
  }
})
await new Promise(resolve => setImmediate(resolve))
const refused_note = output.textContent
await settle()
const refused_tries = tries
tries = 0
await mount(stage, {
  ...theme_options,
  focus: false,
  wasm_url,
  open: async () => {
    if (++tries < 3) throw new TypeError('network')
    return new WebSocket('wss://gate.test/pty')
  }
})
await settle()

const checks = {
  open_gets_size:
    asked.length === 1 &&
    asked[0].cols >= 20 &&
    asked[0].rows >= 6 &&
    sockets.length >= 0,
  close_removes_listeners:
    before_close > 0 && after_close === 0 && closed_socket,
  refusal_stops: refused_tries === 1,
  drop_retries: tries === 3
}
for (const [name, ok] of Object.entries(checks))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
process.exit(Object.values(checks).every(Boolean) ? 0 : 1)
