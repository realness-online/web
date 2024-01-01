const mock_dir = {
  prefixes: [],
  items: [],
  path: '/a/fake/path'
}
export const getStorage = vi.fn()
export const ref = vi.fn()
export const putString = vi.fn(() => Promise.resolve())
export const getDownloadURL = vi.fn(() => Promise.resolve('/path/to/file.html'))
export const listAll = vi.fn(() => Promise.resolve(mock_dir))
// export const delete = vi.fn(() => Promise.resolve())
export const getMetadata = vi.fn(() => Promise.resolve())
