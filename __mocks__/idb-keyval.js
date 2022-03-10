import { vi } from 'vitest'
module.exports.get = vi.fn(() => Promise.resolve(undefined))
module.exports.set = vi.fn(() => Promise.resolve())
module.exports.del = vi.fn(() => Promise.resolve())
module.exports.clear = vi.fn(() => Promise.resolve())
module.exports.keys = vi.fn(() => Promise.resolve([]))
