import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as compressor from '@/workers/compressor'
import pako from 'pako'
import { OPEN_ANGLE } from '@/utils/numbers'

vi.mock('pako', () => ({
  default: {
    deflate: vi.fn(),
    inflate: vi.fn()
  }
}))

describe('compressor worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('compress_html', () => {
    it('compresses HTML string', () => {
      const mock_html = '<html><body>test</body></html>'
      const mock_compressed = new Uint8Array([1, 2, 3, 4])
      pako.deflate.mockReturnValue(mock_compressed)

      const message = { data: { html: mock_html } }
      const result = compressor.compress_html(message)

      expect(pako.deflate).toHaveBeenCalledWith(expect.any(Uint8Array), {
        level: 9
      })
      expect(result).toHaveProperty('blob')
      expect(result.blob).toBeInstanceOf(Blob)
    })
  })

  describe('decompress_html', () => {
    it('decompresses compressed data', () => {
      const mock_compressed = new Uint8Array([1, 2, 3, 4])
      const mock_decompressed = '<html><body>test</body></html>'
      pako.inflate.mockReturnValue(mock_decompressed)

      const message = { data: { compressed: mock_compressed } }
      const result = compressor.decompress_html(message)

      expect(pako.inflate).toHaveBeenCalledWith(mock_compressed, {
        to: 'string'
      })
      expect(result).toHaveProperty('html')
      expect(result.html).toBe(mock_decompressed)
    })

    it('returns uncompressed HTML when data starts with <', () => {
      const mock_uncompressed = new Uint8Array([OPEN_ANGLE, 104, 116, 109, 108])
      const decoded_html = new TextDecoder().decode(mock_uncompressed)

      const message = { data: { compressed: mock_uncompressed } }
      const result = compressor.decompress_html(message)

      expect(pako.inflate).not.toHaveBeenCalled()
      expect(result).toHaveProperty('html')
      expect(result.html).toBe(decoded_html)
    })
  })

  describe('route_message', () => {
    it('routes compress:html message', () => {
      const mock_html = '<html><body>test</body></html>'
      const mock_compressed = new Uint8Array([1, 2, 3])
      pako.deflate.mockReturnValue(mock_compressed)

      const message = { data: { route: 'compress:html', html: mock_html } }
      const result = compressor.route_message(message)

      expect(result).toHaveProperty('blob')
    })

    it('routes decompress:html message', () => {
      const mock_compressed = new Uint8Array([1, 2, 3])
      const mock_decompressed = '<html><body>test</body></html>'
      pako.inflate.mockReturnValue(mock_decompressed)

      const message = {
        data: { route: 'decompress:html', compressed: mock_compressed }
      }
      const result = compressor.route_message(message)

      expect(result).toHaveProperty('html')
      expect(result.html).toBe(mock_decompressed)
    })

    it('handles unknown route', () => {
      const message = { data: { route: 'unknown:route' } }
      const result = compressor.route_message(message)

      expect(result).toHaveProperty('error')
      expect(result.error).toBe('Unknown route: unknown:route')
    })
  })
})
