import { vi } from 'vitest'
export const get = vi.fn(() => Promise.resolve(undefined))
export const set = vi.fn(() => Promise.resolve())
export const del = vi.fn(() => Promise.resolve())
export const clear = vi.fn(() => Promise.resolve())
export const keys = vi.fn(() => Promise.resolve([]))
