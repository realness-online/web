import { beforeEach } from 'vitest'

/**
 * In-memory Storage: getItem/setItem and named keys (`localStorage.me`) match browser behavior.
 * Runs after tests/setup.js; replaces non-persistent vi.fn() mocks.
 * @returns {Storage}
 */
function create_memory_local_storage() {
  const memory = /** @type {Record<string, string>} */ ({})

  const api = {
    getItem(key) {
      const k = String(key)
      return Object.prototype.hasOwnProperty.call(memory, k) ? memory[k] : null
    },
    setItem(key, value) {
      memory[String(key)] = String(value)
    },
    removeItem(key) {
      delete memory[String(key)]
    },
    clear() {
      for (const k of Object.keys(memory)) delete memory[k]
    },
    key(i) {
      const keys = Object.keys(memory)
      const n = Number(i)
      return n >= 0 && n < keys.length ? keys[n] : null
    }
  }

  Object.defineProperty(api, 'length', {
    get() {
      return Object.keys(memory).length
    },
    enumerable: false,
    configurable: true
  })

  return new Proxy(api, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver)
      if (prop in target) return Reflect.get(target, prop, receiver)
      return memory[prop] ?? null
    },
    set(target, prop, value) {
      if (typeof prop === 'symbol') return false
      if (prop in target && typeof target[prop] === 'function') return false
      if (prop === 'length') return false
      memory[String(prop)] = String(value)
      return true
    },
    deleteProperty(target, prop) {
      if (typeof prop === 'symbol') return false
      delete memory[String(prop)]
      return true
    },
    has(target, prop) {
      if (typeof prop !== 'string') return false
      if (prop in target) return true
      return Object.prototype.hasOwnProperty.call(memory, prop)
    },
    ownKeys() {
      return Object.keys(memory)
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop !== 'string') return undefined
      if (!Object.prototype.hasOwnProperty.call(memory, prop)) return undefined
      return {
        enumerable: true,
        configurable: true,
        value: memory[prop]
      }
    }
  })
}

const memory_storage = create_memory_local_storage()
globalThis.localStorage = memory_storage
if (typeof window !== 'undefined')
  Object.defineProperty(window, 'localStorage', {
    value: memory_storage,
    writable: true,
    configurable: true
  })

beforeEach(() => {
  memory_storage.clear()
})
