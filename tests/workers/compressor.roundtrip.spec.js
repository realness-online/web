import { describe, it, expect } from 'vite-plus/test'
import * as compressor from '@/workers/compressor'
import { OPEN_ANGLE } from '@/utils/numbers'

// The rest of the compressor suite mocks pako out, which proves the call shape
// but not the bytes. Realness keeps every item as a deflated blob in Storage,
// so the library that reads them is a wire format, not an implementation
// detail: a major bump has to stay readable in both directions.

const html =
  '<address itemscope itemtype="/person"><span itemprop="first_name">Scott</span></address>'

// Produced by pako 2.1.0 at level 9, the version realness shipped before the
// bump. Every blob already sitting in Storage looks like this.
const pako_2_bytes = new Uint8Array([
  120, 218, 45, 140, 193, 9, 192, 48, 8, 0, 87, 41, 46, 144, 5, 140, 75, 116,
  128, 18, 18, 11, 121, 68, 69, 253, 116, 251, 210, 208, 223, 193, 29, 135, 109,
  12, 231, 136, 99, 38, 175, 232, 106, 188, 41, 31, 227, 10, 197, 216, 67, 5, 8,
  195, 154, 108, 97, 174, 86, 225, 158, 30, 121, 73, 91, 12, 116, 118, 205, 196,
  242, 21, 132, 229, 223, 209, 11, 182, 52, 32, 126
])

describe('compressor round trip', () => {
  it('reads back what it wrote', async () => {
    const { blob } = compressor.compress_html({ data: { html } })
    const compressed = new Uint8Array(await blob.arrayBuffer())

    expect(compressor.decompress_html({ data: { compressed } }).html).toBe(html)
  })

  it('still reads a blob written by the version before the bump', () => {
    const result = compressor.decompress_html({
      data: { compressed: pako_2_bytes }
    })

    expect(result.html).toBe(html)
  })

  it('writes something the passthrough will not mistake for plain html', async () => {
    const { blob } = compressor.compress_html({ data: { html } })
    const compressed = new Uint8Array(await blob.arrayBuffer())

    expect(compressed[0]).not.toBe(OPEN_ANGLE)
    expect(compressed.length).toBeLessThan(html.length)
  })
})
