import { describe, it, expect } from 'vite-plus/test'
import * as compressor from '@/workers/compressor'
import { OPEN_ANGLE } from '@/utils/numbers'
import { version_of } from '#root/src/files/version.js'

const html =
  '<address itemscope itemtype="/person"><span itemprop="first_name">Scott</span></address>'

const pako_2_bytes = new Uint8Array([
  120, 218, 45, 140, 193, 9, 192, 48, 8, 0, 87, 41, 46, 144, 5, 140, 75, 116,
  128, 18, 18, 11, 121, 68, 69, 253, 116, 251, 210, 208, 223, 193, 29, 135, 109,
  12, 231, 136, 99, 38, 175, 232, 106, 188, 41, 31, 227, 10, 197, 216, 67, 5, 8,
  195, 154, 108, 97, 174, 86, 225, 158, 30, 121, 73, 91, 12, 116, 118, 205, 196,
  242, 21, 132, 229, 223, 209, 11, 182, 52, 32, 126
])

describe('compressor round trip', () => {
  it('reads back what it wrote', async () => {
    const { blob } = await compressor.compress_html({ data: { html } })
    const compressed = new Uint8Array(await blob.arrayBuffer())

    expect(compressor.decompress_html({ data: { compressed } }).html).toBe(html)
  })

  it('still reads a blob written by the version before the bump', () => {
    const result = compressor.decompress_html({
      data: { compressed: pako_2_bytes }
    })

    expect(result.html).toBe(html)
  })

  it('names the version of the plain HTML, not of the gzip', async () => {
    const { version } = await compressor.compress_html({ data: { html } })
    expect(version).toBe(await version_of(html))
  })

  it('writes gzip, which Storage and every reader decode', async () => {
    const { blob } = await compressor.compress_html({ data: { html } })
    const compressed = new Uint8Array(await blob.arrayBuffer())

    expect([compressed[0], compressed[1]]).toEqual([0x1f, 0x8b])
  })

  it('writes something the passthrough will not mistake for plain html', async () => {
    const item = html.repeat(8)
    const { blob } = await compressor.compress_html({ data: { html: item } })
    const compressed = new Uint8Array(await blob.arrayBuffer())

    expect(compressed[0]).not.toBe(OPEN_ANGLE)
    expect(compressed.length).toBeLessThan(item.length)
  })
})
