import { jest } from '@jest/globals'
module.exports.get = jest.fn(() => Promise.resolve(undefined))
module.exports.set = jest.fn(() => Promise.resolve())
module.exports.del = jest.fn(() => Promise.resolve())
module.exports.clear = jest.fn(() => Promise.resolve())
module.exports.keys = jest.fn(() => Promise.resolve([]))
