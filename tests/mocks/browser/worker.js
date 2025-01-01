import { vi } from 'vitest'

global.Worker = vi.fn(() => ({
  addEventListener: vi.fn(),
  terminate: vi.fn(),
  postMessage: vi.fn()
}))
