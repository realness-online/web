import { describe, it, expect } from 'vite-plus/test'
import { read_png_size, IHDR_HEADER_BYTES } from '../../scripts/lib/png-size.js'

/**
 * The first 24 bytes of a png: signature, IHDR length/type, width, height.
 * @param {number} width
 * @param {number} height
 */
const png_header = (width, height) => {
  const buffer = Buffer.alloc(IHDR_HEADER_BYTES)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer)
  buffer.writeUInt32BE(13, 8)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

describe('scripts/lib/png-size', () => {
  it('reads dimensions from the IHDR chunk', () => {
    expect(read_png_size(png_header(3840, 1620))).toEqual({
      width: 3840,
      height: 1620
    })
  })

  it('reads a poster at its traced size', () => {
    expect(read_png_size(png_header(1214, 512))).toEqual({
      width: 1214,
      height: 512
    })
  })

  it('rejects a buffer that is not a png', () => {
    expect(read_png_size(Buffer.alloc(IHDR_HEADER_BYTES))).toBe(null)
  })

  it('rejects a png whose first chunk is not IHDR', () => {
    const buffer = png_header(100, 100)
    buffer.write('IDAT', 12, 'ascii')
    expect(read_png_size(buffer)).toBe(null)
  })

  it('rejects a truncated read', () => {
    expect(read_png_size(png_header(100, 100).subarray(0, 20))).toBe(null)
    expect(read_png_size(undefined)).toBe(null)
  })
})
