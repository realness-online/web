import { vi, describe, it, expect, beforeEach } from 'vitest'

describe('service worker', () => {
  let mock_workbox
  let mock_self

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mock_workbox = {
      core: {
        setCacheNameDetails: vi.fn()
      },
      precaching: {
        precacheAndRoute: vi.fn()
      }
    }

    mock_self = {
      __precacheManifest: [],
      __WB_MANIFEST: [],
      skipWaiting: vi.fn().mockResolvedValue(undefined),
      clients: {
        claim: vi.fn()
      },
      addEventListener: vi.fn()
    }

    Object.defineProperty(mock_self, '__WB_MANIFEST', {
      value: [],
      writable: true,
      configurable: true
    })

    global.self = mock_self
    global.self.workbox = mock_workbox
  })

  it('sets cache name details', async () => {
    await import('@/workers/service')

    expect(mock_workbox.core.setCacheNameDetails).toHaveBeenCalledWith({
      prefix: 'Realness'
    })
  })

  it('precaches manifest', async () => {
    mock_self.__WB_MANIFEST = ['item1', 'item2']
    await import('@/workers/service')

    expect(mock_workbox.precaching.precacheAndRoute).toHaveBeenCalledWith([
      'item1',
      'item2'
    ])
  })

  it('handles install event', async () => {
    await import('@/workers/service')

    const install_handler = mock_self.addEventListener.mock.calls.find(
      call => call[0] === 'install'
    )?.[1]

    if (install_handler) {
      await install_handler()
      expect(mock_self.skipWaiting).toHaveBeenCalled()
    }
  })

  it('handles activate event', async () => {
    await import('@/workers/service')

    const activate_handler = mock_self.addEventListener.mock.calls.find(
      call => call[0] === 'activate'
    )?.[1]

    if (activate_handler) {
      activate_handler()
      expect(mock_self.clients.claim).toHaveBeenCalled()
    }
  })

  it('concatenates existing precache manifest', async () => {
    mock_self.__precacheManifest = ['existing-item']
    mock_self.__WB_MANIFEST = ['wb-item']
    await import('@/workers/service')

    expect(mock_workbox.precaching.precacheAndRoute).toHaveBeenCalledWith([
      'wb-item'
    ])
    expect(mock_self.__precacheManifest).toEqual(['existing-item'])
  })
})

