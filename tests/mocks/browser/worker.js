import { vi } from 'vitest'

global.Worker = vi.fn(function () {
  return {
    addEventListener: vi.fn(),
    terminate: vi.fn(),
    postMessage: vi.fn()
  }
})
