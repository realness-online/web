import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { is_entry, run_entry } from '../../../scripts/lib/entry.js'

const script = '/repo/scripts/tool.js'
const url = pathToFileURL(script).href
const argv = process.argv

afterEach(() => {
  process.argv = argv
  vi.restoreAllMocks()
})

describe('is_entry', () => {
  it('matches the script Node ran', () => {
    process.argv = ['node', script]
    expect(is_entry(url)).toBe(true)
    process.argv = ['node', '/repo/scripts/other.js']
    expect(is_entry(url)).toBe(false)
    process.argv = ['node']
    expect(is_entry(url)).toBe(false)
  })
})

describe('run_entry', () => {
  it('skips main when imported', async () => {
    const main = vi.fn()
    await run_entry(url, main)
    expect(main).not.toHaveBeenCalled()
  })

  it('runs main as a command', async () => {
    process.argv = ['node', script]
    const main = vi.fn()
    await run_entry(url, main)
    expect(main).toHaveBeenCalledOnce()
  })

  it('prints a failure and exits 1', async () => {
    process.argv = ['node', script]
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await run_entry(url, () => {
      throw new Error('broken')
    })
    await run_entry(url, () => {
      throw 'plain'
    })
    expect(error.mock.calls).toEqual([['broken'], ['plain']])
    expect(exit).toHaveBeenCalledWith(1)
  })
})
