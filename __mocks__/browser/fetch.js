global.fetch = vi.fn(() =>
  Promise.resolve({
    text: vi.fn(() => Promise.resolve(''))
  })
)
