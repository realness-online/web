import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { main } from '../../../scripts/check-color-flip.js'

const args = ['--dir', '.', '--route', '/x']

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('check-color-flip', () => {
  it('passes when nothing stuck', async () => {
    await main({ args, run: async () => [] })
  })
  it('fails on any problem', async () => {
    await expect(
      main({ args, run: async () => ['diagram --_fg stayed x'] })
    ).rejects.toThrow('1 problem(s)')
  })
  it('needs a site and a page', async () => {
    await expect(main({ args: [], run: async () => [] })).rejects.toThrow(
      '--dir and --route'
    )
  })
})
