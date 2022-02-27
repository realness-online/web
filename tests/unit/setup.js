import { jest } from '@jest/globals'
global.jest = jest
console.info = jest.fn()
console.time = jest.fn()
console.trace = jest.fn()
console.timeEnd = jest.fn()
