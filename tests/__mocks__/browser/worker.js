global.Worker = vi.fn(() => {
  return {
    addEventListener: vi.fn(),
    terminate: vi.fn(),
    postMessage: vi.fn()
  }
})
