import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import { log_storage_estimate } from '@/utils/storage-estimate'

describe('@/utils/storage-estimate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs usage when navigator.storage.estimate is available', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 850, quota: 1000 })
      }
    })

    await log_storage_estimate()

    expect(navigator.storage.estimate).toHaveBeenCalled()
    expect(info).toHaveBeenCalledWith(
      '[storage] estimate',
      expect.objectContaining({ pct_used: 85 })
    )
  })

  it('warns when usage is above warn threshold', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 900, quota: 1000 })
      }
    })

    await log_storage_estimate()

    expect(warn).toHaveBeenCalledWith(
      '[storage] origin storage near quota',
      expect.objectContaining({ pct_used: 90 })
    )
  })
})
