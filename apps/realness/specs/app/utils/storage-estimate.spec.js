import { describe, it, expect, vi, afterEach } from 'vite-plus/test'
import { log_storage_estimate } from '@/utils/storage-estimate'

describe('@/utils/storage-estimate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('says nothing when storage is nowhere near quota', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn().mockResolvedValue({ usage: 100, quota: 1000 })
      }
    })

    await log_storage_estimate()

    expect(navigator.storage.estimate).toHaveBeenCalled()
    expect(info).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
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
