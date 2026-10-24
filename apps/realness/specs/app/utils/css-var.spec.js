import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import css_var from '@/utils/css-var'

describe('@/utils/css-var', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads a custom property from the document root', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: name =>
        name === '--accent' ? ' oklch(0.6 0.1 20) ' : ''
    })

    expect(css_var('--accent')).toBe(' oklch(0.6 0.1 20) ')
  })

  it('answers empty for a property that is not set', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => ''
    })

    expect(css_var('--missing')).toBe('')
  })

  it('answers empty when there is no document to read', async () => {
    const saved = globalThis.document
    delete globalThis.document
    vi.resetModules()
    const fresh = (await import('@/utils/css-var')).default

    expect(fresh('--accent')).toBe('')
    globalThis.document = saved
  })
})
