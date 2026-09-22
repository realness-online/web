import { vi } from 'vite-plus/test'

// In-memory idb-keyval, one module instance per test file that mocks it.
const store = new Map()

export const get = vi.fn(async key => store.get(key))
export const set = vi.fn(async (key, value) => {
  store.set(key, value)
})
export const del = vi.fn(async key => {
  store.delete(key)
})
export const keys = vi.fn(async () => [...store.keys()])
export const clear = vi.fn(() => {
  store.clear()
})
