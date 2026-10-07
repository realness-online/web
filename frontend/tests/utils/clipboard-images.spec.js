import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { get_clipboard_files } from '@/utils/clipboard-images'

const png = () => new File(['png-bytes'], 'shot.png', { type: 'image/png' })

/** A DataTransferItem carrying a file */
const file_item = (file, type = file.type) => ({
  kind: 'file',
  type,
  getAsFile: () => file
})

/** A DataTransferItem carrying a string, handed back through a callback */
const string_item = (type, value) => ({
  kind: 'string',
  type,
  getAsString: callback => callback(value)
})

const paste = ({ files = [], items = [] } = {}) => ({
  clipboardData: { files, items }
})

describe('@/utils/clipboard-images', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', async url => ({
      blob: async () =>
        new Blob(['bytes'], { type: String(url).slice(5).split(';')[0] })
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('takes the files the clipboard already has', async () => {
    const file = png()
    expect(await get_clipboard_files(paste({ files: [file] }))).toEqual([file])
  })

  it('prefers real files over anything it would have to dig for', async () => {
    const file = png()
    const buried = png()
    const found = await get_clipboard_files(
      paste({ files: [file], items: [file_item(buried)] })
    )
    expect(found).toEqual([file])
  })

  it('falls back to image items when there are no files', async () => {
    const file = png()
    const found = await get_clipboard_files(paste({ items: [file_item(file)] }))
    expect(found).toEqual([file])
  })

  it('ignores items that are not images', async () => {
    const text = { kind: 'file', type: 'text/plain', getAsFile: () => png() }
    expect(await get_clipboard_files(paste({ items: [text] }))).toEqual([])
  })

  describe('a copy from a web page, which arrives as html', () => {
    it('pulls out the images its img tags carry inline', async () => {
      const html = `<img src="data:image/png;base64,AAAA">`
      const found = await get_clipboard_files(
        paste({ items: [string_item('text/html', html)] })
      )
      expect(found).toHaveLength(1)
      expect(found[0]).toBeInstanceOf(File)
      expect(found[0].type).toBe('image/png')
    })

    it('takes every inline image, not just the first', async () => {
      const html = `<img src="data:image/png;base64,AAAA">
                    <img src="data:image/gif;base64,BBBB">`
      const found = await get_clipboard_files(
        paste({ items: [string_item('text/html', html)] })
      )
      expect(found.map(file => file.type)).toEqual(['image/png', 'image/gif'])
    })

    it('leaves behind images the page only linked to', async () => {
      const html = `<img src="https://example.com/shot.png">`
      const found = await get_clipboard_files(
        paste({ items: [string_item('text/html', html)] })
      )
      expect(found).toEqual([])
    })

    it('drops an inline image it cannot read', async () => {
      vi.stubGlobal('fetch', async () => {
        throw new Error('unreadable')
      })
      const html = `<img src="data:image/png;base64,AAAA">`
      const found = await get_clipboard_files(
        paste({ items: [string_item('text/html', html)] })
      )
      expect(found).toEqual([])
    })

    it('copes with html that has no images at all', async () => {
      const found = await get_clipboard_files(
        paste({ items: [string_item('text/html', '<p>just words</p>')] })
      )
      expect(found).toEqual([])
    })
  })

  it('returns nothing when the paste carried no clipboard data', async () => {
    expect(await get_clipboard_files({})).toEqual([])
  })
})
