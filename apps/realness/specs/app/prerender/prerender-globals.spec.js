import { describe, it, expect, beforeEach, afterEach, vi } from 'vite-plus/test'

const THE_GLOBALS = [
  'window',
  'localStorage',
  'navigator',
  'document',
  'IntersectionObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'matchMedia'
]

/** Snapshot what happy-dom provides so the stubs can be removed and restored. */
const saved = new Map()
for (const name of THE_GLOBALS) saved.set(name, globalThis[name])

const remove_globals = () => {
  for (const name of THE_GLOBALS) delete globalThis[name]
}

const restore_globals = () => {
  for (const [name, value] of saved) globalThis[name] = value
}

describe('@/prerender/prerender-globals', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    restore_globals()
  })

  it('installs every stub the prerender needs when none exist', async () => {
    remove_globals()

    await import('@/prerender/prerender-globals')

    expect(typeof globalThis.window.addEventListener).toBe('function')
    expect(typeof globalThis.document.createElement).toBe('function')
    expect(typeof globalThis.document.createElementNS).toBe('function')
    expect(typeof globalThis.document.createTextNode).toBe('function')
    expect(typeof globalThis.IntersectionObserver).toBe('function')
    expect(typeof globalThis.requestAnimationFrame).toBe('function')
    expect(typeof globalThis.cancelAnimationFrame).toBe('function')
    expect(typeof globalThis.requestIdleCallback).toBe('function')
    expect(typeof globalThis.matchMedia).toBe('function')
    expect(globalThis.navigator.userAgent).toBe('node')
  })

  it('gives localStorage the full storage interface', async () => {
    remove_globals()

    await import('@/prerender/prerender-globals')

    const storage = globalThis.localStorage
    expect(storage.length).toBe(0)
    storage.setItem('a', 1)
    expect(storage.getItem('a')).toBe('1')
    expect(storage.key(0)).toBe('a')
    expect(storage.length).toBe(1)
    storage.removeItem('a')
    expect(storage.getItem('a')).toBeNull()
    expect(storage.key(5)).toBeNull()
    storage.setItem('b', 'c')
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('leaves globals that already exist alone', async () => {
    const existing = globalThis.document

    await import('@/prerender/prerender-globals')

    expect(globalThis.document).toBe(existing)
  })

  it('gives the document a body, head and documentElement', async () => {
    remove_globals()

    await import('@/prerender/prerender-globals')

    expect(globalThis.document.body).toBeTruthy()
    expect(globalThis.document.head).toBeTruthy()
    expect(globalThis.document.documentElement).toBeTruthy()
    expect(globalThis.document.querySelector('.x')).toBeNull()
    expect(globalThis.document.querySelectorAll('.x')).toEqual([])
    expect(globalThis.document.getElementById('x')).toBeNull()
  })

  it('answers matchMedia with no match and inert listeners', async () => {
    remove_globals()

    await import('@/prerender/prerender-globals')

    const query = globalThis.matchMedia('(prefers-color-scheme: dark)')
    expect(query.matches).toBe(false)
    expect(() => query.addEventListener('change', () => {})).not.toThrow()
    expect(() => query.removeEventListener('change', () => {})).not.toThrow()
  })

  it('runs animation frame callbacks through the timer', async () => {
    remove_globals()
    await import('@/prerender/prerender-globals')
    vi.useFakeTimers()
    try {
      const callback = vi.fn()
      globalThis.requestAnimationFrame(callback)
      vi.runAllTimers()
      expect(callback).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
