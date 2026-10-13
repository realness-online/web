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
globalThis.window = { addEventListener() {} }
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

const run = async responses => {
  sockets.length = 0
  timers.length = 0
  output.textContent = ''
  let calls = 0
  globalThis.fetch = async () => {
    const next = responses[Math.min(calls++, responses.length - 1)]
    if (next === 'drop') throw new TypeError('Failed to fetch')
    return {
      ok: next === 200,
      status: next,
      json: async () => ({ ticket: 't' })
    }
  }
  const { mount } = await import('../../../src/terminal/terminal.js')
  await mount(stage, {
    ...theme_options,
    actor: 'a1',
    wasm_url: new URL('../public/ghostty-vt.wasm', import.meta.url),
    focus: false
  })
  for (let i = 0; i < 10 && !sockets.length; i++) {
    await new Promise(resolve => setImmediate(resolve))
    const fn = timers.shift()
    if (fn) await fn()
  }
  return { calls, sockets: sockets.length, note: output.textContent }
}

const dropped = await run(['drop', 'drop', 503, 200])
const refused = await run([401])
const refusal_stopped =
  refused.sockets === 0 && refused.calls === 1 && timers.length === 0
const { mount } = await import('../../../src/terminal/terminal.js')
timers.length = 0
let closed_calls = 0
const closed_terminal = await mount(stage, {
  ...theme_options,
  actor: 'a1',
  wasm_url: new URL('../public/ghostty-vt.wasm', import.meta.url),
  focus: false,
  open: async () => {
    closed_calls++
    throw new Error('network dropped')
  }
})
await new Promise(resolve => setImmediate(resolve))
closed_terminal.close()
for (const callback of timers.splice(0)) await callback()
await new Promise(resolve => setImmediate(resolve))
const no_closed_reconnect = closed_calls === 1

timers.length = 0
let reject_open
const closing_terminal = await mount(stage, {
  ...theme_options,
  actor: 'a1',
  wasm_url: new URL('../public/ghostty-vt.wasm', import.meta.url),
  focus: false,
  open: () =>
    new Promise((_, reject) => {
      reject_open = reject
    })
})
closing_terminal.close()
reject_open(new Error('closed while opening'))
await new Promise(resolve => setImmediate(resolve))
const no_late_retry = timers.length === 0

const checks = {
  closed_terminal_never_reopens: no_closed_reconnect,
  close_during_open_never_retries: no_late_retry,
  drop_then_503_reattaches: dropped.sockets === 1 && dropped.calls === 4,
  refusal_stops: refusal_stopped
}
for (const [name, ok] of Object.entries(checks))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
process.exit(Object.values(checks).every(Boolean) ? 0 : 1)
