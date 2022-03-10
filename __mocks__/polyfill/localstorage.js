import { vi } from 'vitest'
globalThis.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn()
}
