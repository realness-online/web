import { describe, it, expect, vi } from 'vitest'
import * as optimize from '@/workers/optimize'

describe('optimize worker', () => {
  const mock_image = {
    quality: vi.fn(() => mock_image),
    writeAsync: vi.fn()
  }

  it('optimizes images', async () => {
    const image = new Uint8Array([1, 2, 3])
    await optimize.listen({ data: { image } })
    expect(mock_image.quality).toHaveBeenCalled()
    expect(mock_image.writeAsync).toHaveBeenCalled()
  })

  it('handles optimization with specific quality', async () => {
    const image = new Uint8Array([1, 2, 3])
    const quality = 75
    await optimize.listen({ data: { image, quality } })
    expect(mock_image.quality).toHaveBeenCalledWith(quality)
  })
})
