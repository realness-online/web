import { vi } from 'vitest'
import { indexedDB } from "fake-indexeddb"
globalThis.indexedDB = indexedDB
console.log('setup')
console.info = vi.fn()
console.time = vi.fn()
console.trace = vi.fn()
console.timeEnd = vi.fn()
