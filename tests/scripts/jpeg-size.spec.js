import { describe, it, expect } from 'vite-plus/test'
import { read_jpeg_size } from '../../scripts/lib/jpeg-size.js'

/**
 * Smallest jpeg-shaped buffer that carries a start-of-frame segment.
 * @param {number} width
 * @param {number} height
 */
const jpeg_with_frame = (width, height) => {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00])
  const sof = Buffer.alloc(11)
  sof.writeUInt16BE(0xffc0, 0)
  sof.writeUInt16BE(9, 2)
  sof.writeUInt8(8, 4)
  sof.writeUInt16BE(height, 5)
  sof.writeUInt16BE(width, 7)
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof])
}

describe('scripts/lib/jpeg-size', () => {
  it('reads dimensions from the start of frame segment', () => {
    expect(read_jpeg_size(jpeg_with_frame(1200, 630))).toEqual({
      width: 1200,
      height: 630
    })
  })

  it('skips segments that are not frames', () => {
    expect(read_jpeg_size(jpeg_with_frame(64, 64))).toEqual({
      width: 64,
      height: 64
    })
  })

  it('returns null for a file that is not a jpeg', () => {
    expect(read_jpeg_size(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(null)
  })
})
