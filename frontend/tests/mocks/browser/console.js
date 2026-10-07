import { vi } from 'vite-plus/test'

console.info = vi.fn()
console.time = vi.fn()
console.trace = vi.fn()
console.timeEnd = vi.fn()
