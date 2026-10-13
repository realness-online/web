import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { create_firebase_backend } from '../src/firebase.js'
import {
  deleteObject,
  getBytes,
  getDownloadURL,
  getMetadata,
  listAll,
  uploadBytes,
  uploadString,
  StringFormat
} from 'firebase/storage'

vi.mock('firebase/storage', () => ({
  deleteObject: vi.fn(async () => {}),
  getBytes: vi.fn(async () => new Uint8Array([1, 2])),
  getDownloadURL: vi.fn(async ref => `https://example.test/${ref.path}`),
  getMetadata: vi.fn(async () => ({
    contentType: 'text/html; charset=utf-8',
    contentEncoding: 'deflate',
    customMetadata: { hash: 'abc' },
    generation: '7',
    updated: 'now'
  })),
  listAll: vi.fn(async ref => ({
    items: [{ name: 'a.html.gz' }],
    prefixes: []
  })),
  uploadBytes: vi.fn(async () => ({ ref: { path: 'uploaded' } })),
  uploadString: vi.fn(async () => ({ ref: { path: 'uploaded' } })),
  StringFormat: { RAW: 'raw' }
}))

const location = path => ({
  path,
  toString: () => `gs://bucket/${path}`
})

const make_backend = (overrides = {}) =>
  create_firebase_backend({ location, signed_in: () => true, ...overrides })

describe('create_firebase_backend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('needs a location function', () => {
    expect(() => create_firebase_backend()).toThrow(/location/)
  })

  it('uploads a Blob with uploadBytes', async () => {
    const backend = make_backend()

    await backend.upload('a.html.gz', new Blob(['x']), {
      contentType: 'text/html'
    })

    expect(uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'a.html.gz' }),
      expect.any(Blob),
      { contentType: 'text/html' }
    )
    expect(uploadString).not.toHaveBeenCalled()
  })

  it('uploads a string with uploadString raw', async () => {
    const backend = make_backend()

    await backend.upload('a.html.gz', '<article/>', {
      contentType: 'text/html'
    })

    expect(uploadString).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'a.html.gz' }),
      '<article/>',
      StringFormat.RAW,
      { contentType: 'text/html' }
    )
  })

  it('ignores object-not-found on remove', async () => {
    deleteObject.mockRejectedValueOnce({ code: 'storage/object-not-found' })
    const backend = make_backend()

    await backend.remove('gone.html.gz')
  })

  it('rethrows other remove errors', async () => {
    deleteObject.mockRejectedValueOnce({ code: 'storage/unauthorized' })
    const backend = make_backend()

    await expect(backend.remove('nope.html.gz')).rejects.toEqual({
      code: 'storage/unauthorized'
    })
  })

  it('moves by copying the bytes and metadata, then deleting the source', async () => {
    const backend = make_backend()

    expect(await backend.move('a.html.gz', 'b.html.gz')).toBe(true)

    expect(getBytes).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'a.html.gz' })
    )
    expect(uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'b.html.gz' }),
      expect.any(Uint8Array),
      {
        contentType: 'text/html; charset=utf-8',
        contentEncoding: 'deflate',
        customMetadata: { hash: 'abc' }
      }
    )
    expect(deleteObject).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'a.html.gz' })
    )
  })

  it('takes the copy with it when the source delete fails', async () => {
    deleteObject.mockRejectedValueOnce({ code: 'storage/unknown' })
    const backend = make_backend()

    expect(await backend.move('a.html.gz', 'b.html.gz')).toBe(false)
    expect(deleteObject).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'b.html.gz' })
    )
  })

  it('reports false when the copy fails', async () => {
    uploadBytes.mockRejectedValueOnce(new Error('offline'))
    const backend = make_backend()

    expect(await backend.move('a.html.gz', 'b.html.gz')).toBe(false)
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('resolves urls and lists directories', async () => {
    const backend = make_backend()

    expect(await backend.url('a.html.gz')).toBe(
      'https://example.test/a.html.gz'
    )
    expect(await backend.directory('people/+1/posters/')).toEqual({
      items: [{ name: 'a.html.gz' }],
      prefixes: []
    })
    expect(getDownloadURL).toHaveBeenCalled()
    expect(listAll).toHaveBeenCalled()
  })

  it('passes the app hooks through', () => {
    const later = vi.fn()
    const after_upload = vi.fn()
    const backend = make_backend({ later, after_upload })

    expect(backend.later).toBe(later)
    expect(backend.after_upload).toBe(after_upload)
  })
})
