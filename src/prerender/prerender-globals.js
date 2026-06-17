// @ts-nocheck — minimal DOM stubs for Node prerender only
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map()
  globalThis.localStorage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem: key => (store.has(key) ? store.get(key) : null),
    key: index => [...store.keys()][index] ?? null,
    removeItem: key => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, String(value))
    }
  }
}

if (typeof globalThis.navigator === 'undefined')
  globalThis.navigator = { userAgent: 'node', language: 'en-US' }

if (typeof globalThis.document === 'undefined') {
  const noop = () => {}
  const stub_el = {
    style: {},
    setAttribute: noop,
    appendChild: noop,
    removeChild: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    getAttribute: () => null
  }
  globalThis.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => stub_el,
    createElementNS: () => stub_el,
    createTextNode: () => stub_el,
    addEventListener: noop,
    removeEventListener: noop,
    body: stub_el,
    head: stub_el,
    documentElement: stub_el
  }
}

if (typeof globalThis.IntersectionObserver === 'undefined')
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

if (typeof globalThis.requestAnimationFrame === 'undefined')
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0)

if (typeof globalThis.cancelAnimationFrame === 'undefined')
  globalThis.cancelAnimationFrame = id => clearTimeout(id)

if (typeof globalThis.requestIdleCallback === 'undefined')
  globalThis.requestIdleCallback = callback => setTimeout(callback, 0)

if (typeof globalThis.matchMedia === 'undefined')
  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  })
